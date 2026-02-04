#!/usr/bin/env python3
"""
Neo4j Schema Discovery - Find what's actually in the database
"""

from neo4j import GraphDatabase
from datetime import datetime

URI = "bolt://localhost:7687"
USER = "neo4j"
PASSWORD = "password"

class Neo4jExplorer:
    def __init__(self):
        self.driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
        
    def close(self):
        self.driver.close()
        
    def run_query(self, query, params=None):
        with self.driver.session() as session:
            result = session.run(query, params or {})
            return list(result)
    
    def explore(self):
        print("=" * 80)
        print("NEO4J DATABASE EXPLORATION")
        print("=" * 80)
        
        # Get all node labels
        print("\n📋 NODE LABELS:")
        print("-" * 50)
        labels_query = """
        CALL db.labels() YIELD label
        RETURN label
        ORDER BY label
        """
        labels = self.run_query(labels_query)
        for l in labels:
            # Count nodes with this label
            count_query = f"MATCH (n:`{l['label']}`) RETURN count(n) AS cnt"
            count = self.run_query(count_query)[0]['cnt']
            print(f"  • {l['label']}: {count} nodes")
        
        # Get all relationship types
        print("\n🔗 RELATIONSHIP TYPES:")
        print("-" * 50)
        rels_query = """
        CALL db.relationshipTypes() YIELD relationshipType
        RETURN relationshipType
        ORDER BY relationshipType
        """
        rels = self.run_query(rels_query)
        for r in rels:
            count_query = f"MATCH ()-[r:`{r['relationshipType']}`]->() RETURN count(r) AS cnt"
            count = self.run_query(count_query)[0]['cnt']
            print(f"  • {r['relationshipType']}: {count} relationships")
        
        # Get property keys
        print("\n🔑 PROPERTY KEYS:")
        print("-" * 50)
        props_query = """
        CALL db.propertyKeys() YIELD propertyKey
        RETURN propertyKey
        ORDER BY propertyKey
        """
        props = self.run_query(props_query)
        for p in props:
            print(f"  • {p['propertyKey']}")
        
        # Sample nodes if any exist
        print("\n📊 SAMPLE NODES (first 5):")
        print("-" * 50)
        sample_query = """
        MATCH (n)
        RETURN labels(n) AS labels, n
        LIMIT 5
        """
        samples = self.run_query(sample_query)
        for s in samples:
            print(f"\n  Labels: {s['labels']}")
            props = dict(s['n'].items())
            for k, v in props.items():
                print(f"    {k}: {v[:50] if isinstance(v, str) and len(v) > 50 else v}")
        
        # Sample relationships if any exist
        print("\n📊 SAMPLE RELATIONSHIPS (first 5):")
        print("-" * 50)
        rel_sample_query = """
        MATCH (a)-[r]->(b)
        RETURN labels(a) AS from_labels, a.name AS from_name, 
               type(r) AS rel_type, r,
               labels(b) AS to_labels, b.name AS to_name
        LIMIT 5
        """
        rel_samples = self.run_query(rel_sample_query)
        for r in rel_samples:
            print(f"\n  ({r['from_labels']})-[:{r['rel_type']}]->({r['to_labels']})")
            print(f"    From: {r['from_name']}")
            print(f"    To: {r['to_name']}")
            print(f"    Props: {dict(r['r'].items())}")
        
        # Overall stats
        print("\n📈 OVERALL STATISTICS:")
        print("-" * 50)
        stats_query = """
        MATCH (n)
        WITH count(n) AS nodeCount
        MATCH ()-[r]->()
        RETURN nodeCount, count(r) AS relCount
        """
        stats = self.run_query(stats_query)
        if stats:
            print(f"  Total Nodes: {stats[0]['nodeCount']}")
            print(f"  Total Relationships: {stats[0]['relCount']}")
        
        print("\n" + "=" * 80)

if __name__ == "__main__":
    explorer = Neo4jExplorer()
    try:
        explorer.explore()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        explorer.close()
