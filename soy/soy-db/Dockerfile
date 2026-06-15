FROM postgres:17-alpine

USER root
RUN chown -R postgres /var/lib/postgresql/data

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

USER postgres
