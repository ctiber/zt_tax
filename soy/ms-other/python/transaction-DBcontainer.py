# Works fine from flask container once env variables are available (thanks to docker-compose.yml)

# ok locks seem to work perfectly to impede other processes to look at db

import os
import psycopg2
import time

pg_host=os.getenv('POSTGRES_HOST')
the_user=os.getenv('POSTGRES_USER')
its_pass=os.getenv('POSTGRES_PASSWORD')

#print(the_user+" / "+its_pass)

# Connect to your postgres DB
# postgres container needs to be named in (container_name in docker-compose file)
conn = psycopg2.connect("host="+pg_host+" dbname=exercise5 user="+the_user+" password="+its_pass)

# Open a cursor to perform database operations
cur = conn.cursor()

# LOCKS table
cur.execute("LOCK available")

# Execute a query
cur.execute("SELECT * from available");

# Retrieve just one row
(user,password) = cur.fetchone()
print(user+' / '+password)

# waits 10 secs to simulate hard work
time.sleep(10) 
cur.execute("delete from available where name='"+user+"'");

# commits transaction to unlock table for other processes
conn.commit()

