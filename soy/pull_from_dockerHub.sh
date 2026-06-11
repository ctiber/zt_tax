
#!/bin/bash
IMAGES=(
    "icws24submission/postgres_icws24:latest"
    "icws24submission/gateway_icws24:latest"
    "icws24submission/exercise_icws24:latest"
    "icws24submission/other_icws24:latest"
    "icws24submission/front_v5:latest"
)


pull() {
    IMAGE=$1
    echo "Image pulled: $IMAGE"
    docker pull $IMAGE

    echo "\n"

    IMAGE_NAME=$(echo $IMAGE | cut -d':' -f1)
    CONTAINER_NAME=$(echo $IMAGE_NAME | tr '/' '_')

    echo "\n"
}

for IMAGE in "${IMAGES[@]}" 
do
    pull $IMAGE
done

echo "All images pulled successfully."

