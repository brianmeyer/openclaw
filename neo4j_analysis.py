#!/usr/bin/env python3
"""
Neo4j Temporal Knowledge Graph Data Quality Analysis
"""

from neo4j import GraphDatabase
from collections import Counter
from datetime import datetime
import re

URI = "bolt://localhost:7687"
USER = "neo4j"
PASSWORD = "password"

class Neo4jAnalyzer:
    def __init__(self):
        self.driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
        self.findings = []
        
    def close(self):
        self.driver.close()
        
    def run_query(self, query, params=None):
        with self.driver.session() as session:
            result = session.run(query, params or {})
            return list(result)
    
    def query_1_top_entities(self):
        """Find most mentioned entities (top 10 by mention_count)"""
        query = """
        MATCH (e:Entity)
        WHERE e.mention_count IS NOT NULL
        RETURN e.name AS name, e.mention_count AS mentions, 
               e.first_mentioned AS first, e.last_mentioned AS last
        ORDER BY e.mention_count DESC
        LIMIT 10
        """
        results = self.run_query(query)
        return [
            {
                "name": r["name"],
                "mentions": r["mentions"],
                "first": r["first"],
                "last": r["last"]
            }
            for r in results
        ]
    
    def query_2_relationship_strength(self):
        """Find entities with highest relationship strength"""
        query = """
        MATCH (e1:Entity)-[r:RELATES_TO]->(e2:Entity)
        WHERE r.strength IS NOT NULL
        RETURN e1.name AS source, e2.name AS target, 
               r.strength AS strength, r.count AS count,
               r.first_seen AS first_seen, r.last_seen AS last_seen
        ORDER BY r.strength DESC
        LIMIT 10
        """
        results = self.run_query(query)
        return [
            {
                "source": r["source"],
                "target": r["target"],
                "strength": r["strength"],
                "count": r["count"],
                "first_seen": r["first_seen"],
                "last_seen": r["last_seen"]
            }
            for r in results
        ]
    
    def query_3_duplicate_entities(self):
        """Check for duplicate/similar entity names"""
        query = """
        MATCH (e:Entity)
        RETURN e.name AS name
        """
        results = self.run_query(query)
        names = [r["name"] for r in results if r["name"]]
        
        duplicates = []
        name_groups = {}
        
        # Group by normalized name (lowercase, no spaces)
        for name in names:
            normalized = re.sub(r'[^\w]', '', name.lower())
            if normalized not in name_groups:
                name_groups[normalized] = []
            name_groups[normalized].append(name)
        
        # Find groups with multiple variations
        for norm, group in name_groups.items():
            if len(group) > 1:
                duplicates.append({
                    "normalized": norm,
                    "variations": group,
                    "count": len(group)
                })
        
        # Also check for similar names (case-insensitive matches)
        case_variants = {}
        for name in names:
            lower = name.lower()
            if lower not in case_variants:
                case_variants[lower] = []
            case_variants[lower].append(name)
        
        case_duplicates = [
            {"normalized": k, "variations": v, "count": len(v)}
            for k, v in case_variants.items() if len(v) > 1
        ]
        
        return {
            "exact_duplicates": duplicates,
            "case_variants": case_duplicates,
            "total_entities": len(names),
            "unique_normalized": len(name_groups)
        }
    
    def query_4_temporal_range(self):
        """Find entities with oldest vs newest last_mentioned timestamps"""
        # Oldest
        oldest_query = """
        MATCH (e:Entity)
        WHERE e.last_mentioned IS NOT NULL
        RETURN e.name AS name, e.last_mentioned AS last_mentioned,
               e.mention_count AS mentions
        ORDER BY e.last_mentioned ASC
        LIMIT 10
        """
        
        # Newest
        newest_query = """
        MATCH (e:Entity)
        WHERE e.last_mentioned IS NOT NULL
        RETURN e.name AS name, e.last_mentioned AS last_mentioned,
               e.mention_count AS mentions
        ORDER BY e.last_mentioned DESC
        LIMIT 10
        """
        
        oldest = [{"name": r["name"], "last_mentioned": r["last_mentioned"], 
                   "mentions": r["mentions"]} for r in self.run_query(oldest_query)]
        newest = [{"name": r["name"], "last_mentioned": r["last_mentioned"], 
                   "mentions": r["mentions"]} for r in self.run_query(newest_query)]
        
        # Overall stats
        stats_query = """
        MATCH (e:Entity)
        WHERE e.last_mentioned IS NOT NULL
        RETURN 
            count(e) AS total,
            min(e.last_mentioned) AS oldest,
            max(e.last_mentioned) AS newest
        """
        stats_result = self.run_query(stats_query)
        stats = stats_result[0] if stats_result else None
        
        return {
            "oldest": oldest,
            "newest": newest,
            "stats": {
                "total_with_timestamps": stats["total"] if stats else 0,
                "oldest_timestamp": stats["oldest"] if stats else None,
                "newest_timestamp": stats["newest"] if stats else None
            }
        }
    
    def query_5_orphaned_relationships(self):
        """Identify orphaned relationships (where source or target doesn't exist)"""
        # Check for relationships with missing source
        orphaned_source = """
        MATCH ()-[r:RELATES_TO]->(target:Entity)
        WHERE NOT EXISTS {
            MATCH (source:Entity)-[r]->(target)
        }
        RETURN count(r) AS count
        """
        
        # Check for relationships with missing target
        orphaned_target = """
        MATCH (source:Entity)-[r:RELATES_TO]->()
        WHERE NOT EXISTS {
            MATCH (source)-[r]->(target:Entity)
        }
        RETURN count(r) AS count
        """
        
        # Actually find orphaned relationships properly
        orphaned_query = """
        MATCH ()-[r:RELATES_TO]-()
        WITH r
        OPTIONAL MATCH (source:Entity)-[r]->(target:Entity)
        WITH r, source, target
        WHERE source IS NULL OR target IS NULL
        RETURN count(r) AS orphaned_count
        """
        
        # Better approach: find relationship nodes that don't connect properly
        all_rels = """
        MATCH ()-[r:RELATES_TO]->()
        RETURN count(r) AS total_relationships
        """
        
        # Find relationships where either endpoint is missing Entity label
        bad_rels = """
        MATCH (a)-[r:RELATES_TO]->(b)
        WHERE NOT a:Entity OR NOT b:Entity
        RETURN count(r) AS bad_count
        """
        
        total = self.run_query(all_rels)
        bad = self.run_query(bad_rels)
        
        return {
            "total_relationships": total[0]["total_relationships"] if total else 0,
            "non_entity_endpoints": bad[0]["bad_count"] if bad else 0
        }
    
    def query_6_data_completeness(self):
        """Check data completeness: % of entities with all temporal fields"""
        
        # Total entities
        total_query = "MATCH (e:Entity) RETURN count(e) AS total"
        total = self.run_query(total_query)[0]["total"]
        
        # Entities with all temporal fields
        complete_query = """
        MATCH (e:Entity)
        WHERE e.first_mentioned IS NOT NULL 
          AND e.last_mentioned IS NOT NULL
          AND e.mention_count IS NOT NULL
        RETURN count(e) AS complete
        """
        complete = self.run_query(complete_query)[0]["complete"]
        
        # Individual field coverage
        fields_query = """
        MATCH (e:Entity)
        RETURN 
            count(e) AS total,
            count(e.first_mentioned) AS has_first,
            count(e.last_mentioned) AS has_last,
            count(e.mention_count) AS has_mentions,
            count(e.entity_type) AS has_type,
            count(e.canonical_name) AS has_canonical
        """
        fields = self.run_query(fields_query)[0]
        
        return {
            "total_entities": total,
            "fully_complete": complete,
            "percent_complete": round(complete / total * 100, 2) if total > 0 else 0,
            "field_coverage": {
                "first_mentioned": {"count": fields["has_first"], 
                                   "percent": round(fields["has_first"]/total*100, 2) if total else 0},
                "last_mentioned": {"count": fields["has_last"], 
                                  "percent": round(fields["has_last"]/total*100, 2) if total else 0},
                "mention_count": {"count": fields["has_mentions"], 
                                 "percent": round(fields["has_mentions"]/total*100, 2) if total else 0},
                "entity_type": {"count": fields["has_type"], 
                               "percent": round(fields["has_type"]/total*100, 2) if total else 0},
                "canonical_name": {"count": fields["has_canonical"], 
                                  "percent": round(fields["has_canonical"]/total*100, 2) if total else 0}
            }
        }
    
    def generate_report(self):
        """Generate comprehensive data quality report"""
        print("=" * 80)
        print("NEO4J TEMPORAL KNOWLEDGE GRAPH - DATA QUALITY ANALYSIS REPORT")
        print("=" * 80)
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Database: {URI}")
        print("=" * 80)
        print()
        
        # 1. Top Mentioned Entities
        print("1. TOP 10 MOST MENTIONED ENTITIES")
        print("-" * 50)
        top_entities = self.query_1_top_entities()
        if top_entities:
            for i, e in enumerate(top_entities, 1):
                print(f"  {i:2}. {e['name'][:40]:<40} | {e['mentions']:>5} mentions")
                print(f"      First: {e['first'] or 'N/A'}")
                print(f"      Last:  {e['last'] or 'N/A'}")
        else:
            print("  No entities with mention_count found")
        print()
        
        # 2. Highest Relationship Strength
        print("2. TOP 10 RELATIONSHIPS BY STRENGTH")
        print("-" * 50)
        top_rels = self.query_2_relationship_strength()
        if top_rels:
            for i, r in enumerate(top_rels, 1):
                print(f"  {i:2}. {r['source'][:25]} → {r['target'][:25]}")
                print(f"      Strength: {r['strength']:.3f} | Count: {r['count']}")
        else:
            print("  No relationships with strength found")
        print()
        
        # 3. Duplicate/Similar Entities
        print("3. DUPLICATE/SIMILAR ENTITY NAMES")
        print("-" * 50)
        dups = self.query_3_duplicate_entities()
        print(f"  Total Entities: {dups['total_entities']}")
        print(f"  Unique (normalized): {dups['unique_normalized']}")
        print(f"  Potential Duplicates: {dups['total_entities'] - dups['unique_normalized']}")
        print()
        
        if dups["exact_duplicates"]:
            print("  ⚠️  Exact duplicates found:")
            for d in dups["exact_duplicates"][:10]:
                print(f"      Group: {d['variations']}")
        else:
            print("  ✓ No exact duplicates found")
        
        if dups["case_variants"]:
            print(f"\n  ⚠️  Case variants found ({len(dups['case_variants'])} groups):")
            for d in dups["case_variants"][:5]:
                print(f"      {d['variations']}")
        else:
            print("  ✓ No case variants found")
        print()
        
        # 4. Temporal Range
        print("4. TEMPORAL RANGE ANALYSIS")
        print("-" * 50)
        temporal = self.query_4_temporal_range()
        stats = temporal["stats"]
        print(f"  Entities with timestamps: {stats['total_with_timestamps']}")
        print(f"  Oldest mention: {stats['oldest_timestamp']}")
        print(f"  Newest mention: {stats['newest_timestamp']}")
        print()
        print("  Oldest entities (least recently mentioned):")
        for e in temporal["oldest"][:5]:
            print(f"    - {e['name'][:35]:<35} | {e['last_mentioned']}")
        print()
        print("  Newest entities (most recently mentioned):")
        for e in temporal["newest"][:5]:
            print(f"    - {e['name'][:35]:<35} | {e['last_mentioned']}")
        print()
        
        # 5. Orphaned Relationships
        print("5. ORPHANED RELATIONSHIPS")
        print("-" * 50)
        orphans = self.query_5_orphaned_relationships()
        print(f"  Total relationships: {orphans['total_relationships']}")
        print(f"  Non-entity endpoints: {orphans['non_entity_endpoints']}")
        if orphans["non_entity_endpoints"] == 0:
            print("  ✓ All relationships connect Entity nodes")
        else:
            print("  ⚠️  Some relationships have non-Entity endpoints")
        print()
        
        # 6. Data Completeness
        print("6. DATA COMPLETENESS")
        print("-" * 50)
        completeness = self.query_6_data_completeness()
        print(f"  Total Entities: {completeness['total_entities']}")
        print(f"  Fully Complete: {completeness['fully_complete']} ({completeness['percent_complete']}%)")
        print()
        print("  Field Coverage:")
        for field, data in completeness["field_coverage"].items():
            status = "✓" if data["percent"] >= 95 else "⚠️" if data["percent"] >= 50 else "✗"
            print(f"    {status} {field:<18}: {data['count']:>6} ({data['percent']:>6.1f}%)")
        print()
        
        # RECOMMENDATIONS
        print("=" * 80)
        print("RECOMMENDATIONS FOR CLEANUP")
        print("=" * 80)
        
        recommendations = []
        
        # Check duplicates
        if dups["case_variants"] or dups["exact_duplicates"]:
            recommendations.append({
                "priority": "HIGH",
                "issue": "Duplicate Entity Names",
                "action": f"Merge {len(dups['case_variants'])} case-variant groups and {len(dups['exact_duplicates'])} duplicate groups",
                "query": """
                // Example: Merge case variants
                MATCH (e1:Entity), (e2:Entity)
                WHERE toLower(e1.name) = toLower(e2.name) AND id(e1) < id(e2)
                CALL apoc.refactor.mergeNodes([e1, e2], {properties: 'combine'})
                YIELD node
                RETURN node
                """
            })
        
        # Check completeness
        if completeness["percent_complete"] < 100:
            incomplete = completeness["total_entities"] - completeness["fully_complete"]
            recommendations.append({
                "priority": "MEDIUM",
                "issue": "Incomplete Temporal Data",
                "action": f"Backfill missing temporal fields for {incomplete} entities",
                "query": """
                // Find entities missing temporal fields
                MATCH (e:Entity)
                WHERE e.first_mentioned IS NULL OR e.last_mentioned IS NULL
                RETURN e.name, e.first_mentioned, e.last_mentioned
                LIMIT 20
                """
            })
        
        # Check field coverage
        for field, data in completeness["field_coverage"].items():
            if data["percent"] < 50:
                recommendations.append({
                    "priority": "LOW",
                    "issue": f"Low coverage for '{field}'",
                    "action": f"Only {data['percent']}% of entities have {field}",
                    "query": f"""
                    // Find entities missing {field}
                    MATCH (e:Entity)
                    WHERE e.{field} IS NULL
                    RETURN count(e) AS missing_count
                    """
                })
        
        # Check orphaned relationships
        if orphans["non_entity_endpoints"] > 0:
            recommendations.append({
                "priority": "HIGH",
                "issue": "Orphaned Relationships",
                "action": f"Review {orphans['non_entity_endpoints']} relationships with non-Entity endpoints",
                "query": """
                // Find relationships with non-Entity endpoints
                MATCH (a)-[r:RELATES_TO]->(b)
                WHERE NOT a:Entity OR NOT b:Entity
                RETURN labels(a), type(r), labels(b)
                LIMIT 20
                """
            })
        
        # Check for stale entities
        if temporal["oldest"]:
            oldest_date = temporal["oldest"][0]["last_mentioned"]
            if oldest_date:
                recommendations.append({
                    "priority": "INFO",
                    "issue": "Stale Entity Detection",
                    "action": f"Oldest entity last mentioned: {oldest_date}. Consider archiving or reviewing old entities.",
                    "query": """
                    // Find entities not mentioned in last 30 days
                    MATCH (e:Entity)
                    WHERE e.last_mentioned < datetime() - duration('P30D')
                    RETURN e.name, e.last_mentioned, e.mention_count
                    ORDER BY e.last_mentioned ASC
                    LIMIT 20
                    """
                })
        
        for rec in recommendations:
            print(f"\n[{rec['priority']}] {rec['issue']}")
            print(f"  Action: {rec['action']}")
            print(f"  Query:")
            for line in rec['query'].strip().split('\n'):
                print(f"    {line}")
        
        if not recommendations:
            print("  ✓ No major issues detected!")
        
        print()
        print("=" * 80)
        print("END OF REPORT")
        print("=" * 80)

if __name__ == "__main__":
    analyzer = Neo4jAnalyzer()
    try:
        analyzer.generate_report()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        analyzer.close()
