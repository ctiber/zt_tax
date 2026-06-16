# To be run from flask container that has psycpopg installed
# (or from nodedock after installing this module : to do : complete docker-compose.yml for this)
#
# REQUIRES 
# - psycopg python module (install with pip install psycopg2-binary)
#  - to have comptes.txt file next to this script
#
# ok locks seem to work perfectly to impede other processes to look at db


import os
import psycopg2
import re

pg_host=os.getenv('POSTGRES_HOST')
the_user=os.getenv('POSTGRES_USER')
its_pass=os.getenv('POSTGRES_PASSWORD')


# Connect to your postgres DB
# postgres container needs to be named in (container_name in docker-compose file)
conn = psycopg2.connect("host="+pg_host+" dbname=exercise5 user="+the_user+" password="+its_pass)
cur = conn.cursor() # Open a cursor to perform database operations
cur.execute("LOCK available") # LOCKS table

# Read accounts to be created
with open('comptes.txt') as fa:
	Accounts = dict(re.findall(r'(\S+)\s+/\s+(.+)', fa.read()))

for u,p in Accounts.items():
	print(u,p)
	# Inserts into postgres table
	request="INSERT into available VALUES ('"+u+"','"+p+"')"
	print(request)
	cur.execute(request);
# commits transaction to unlock table for other processes
conn.commit()

