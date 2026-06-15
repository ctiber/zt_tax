#!/bin/bash


imagecontent=("exercise-http" "FrontReact" "gateway-http" "other-http" "soy-db")
imagename=("icws24submission/exercise_icws24" "icws24submission/front" "icws24submission/gateway_icws24" "icws24submission/other_icws24" "icws24submission/postgres_icws24")


for i in "${!imagecontent[@]}"; do
     docker build -t "${imagename[$i]}" "${imagecontent[$i]}" 
done

