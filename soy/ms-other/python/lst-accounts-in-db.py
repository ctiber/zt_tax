# Works fine from flask container once env variables are available (thanks to docker-compose.yml)


import os
import psycopg2

pg_host=os.getenv('POSTGRES_HOST')
the_user=os.getenv('POSTGRES_USER')
its_pass=os.getenv('POSTGRES_PASSWORD')

print(the_user+" / "+its_pass)

# Connect to your postgres DB
# postgres container needs to be named in (container_name in docker-compose file)
conn = psycopg2.connect("host="+pg_host+" dbname=exercise5 user="+the_user+" password="+its_pass)

# Open a cursor to perform database operations
cur = conn.cursor()

# Execute a query
cur.execute("SELECT * from available");

# Retrieve query results
records = cur.fetchall()

for acc in records:
    print acc[0],'/', acc[1]


