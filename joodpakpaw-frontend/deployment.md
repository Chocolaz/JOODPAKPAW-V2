# Deployment Workflow Analysis

This document describes the CI/CD deployment workflow based on the `deploy.sh` script found in the project root. The deployment process is designed for a frontend application and utilizes Docker and Docker Compose for containerization and orchestration, including a rollback mechanism in case of failure.

## Workflow Steps:

1.  **Initialization and Configuration:**
    *   The script ensures that it exits immediately if any command fails (`set -e`).
    *   It navigates to the directory where the script resides.
    *   Key variables are defined: `IMAGE_NAME` (joodpakpaw-frontend), `CONTAINER_NAME` (joodpakpaw_frontend), `HEALTH_URL` (http://localhost:3000/capstone25/cp25nk2/), `MAX_RETRIES`, and `RETRY_INTERVAL` for health checks.

2.  **Backup of Current Image (for Rollback):**
    *   Before deploying, the script checks if the container (`joodpakpaw_frontend`) is currently running.
    *   If it is, the currently deployed Docker image is tagged as `joodpakpaw-frontend:backup`. This allows for a quick rollback to the last known working version if the new deployment fails.

3.  **Code Update:**
    *   The latest code changes are fetched from the `main` branch of the `origin` remote (`git fetch origin main`).
    *   The local repository is then hard reset to match the `origin/main` branch, ensuring that the deployment uses the absolute latest version of the code and discarding any local modifications (`git reset --hard origin/main`).

4.  **Environment Variable Preparation:**
    *   A `.env` file is created or overwritten in the project root. This file contains the `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, which is expected to be an environment variable in the execution context of the script. This `.env` file is used by Docker Compose for variable substitution during the build and run phases.

5.  **Build New Docker Image:**
    *   The Docker image for the frontend application is built using the `docker-compose.yml` file. The `--no-cache` flag ensures that the image is built from scratch, reflecting all recent code changes and dependencies.

6.  **Container Redeployment:**
    *   The old running containers and associated networks defined in `docker-compose.yml` are stopped and removed (`docker compose down`).
    *   New containers are then started in detached mode (`-d`) using the newly built Docker image (`docker compose up -d`).

7.  **Health Check:**
    *   After the new containers are brought up, a health check is performed. The script attempts to `curl` the `HEALTH_URL` (http://localhost:3000/capstone25/cp25nk2/) repeatedly.
    *   It tries up to `MAX_RETRIES` (10 times) with a `RETRY_INTERVAL` (5 seconds) between attempts. This ensures the application has time to start up and become responsive.

8.  **Post-Deployment Actions & Rollback:**
    *   **Success:** If the health check passes within the specified retries, a success message is printed, and `docker system prune -f` is executed to clean up any unused Docker data (images, containers, networks, volumes), freeing up disk space.
    *   **Failure/Rollback:** If the health check fails, a failure message is printed, and a rollback procedure is initiated:
        *   The newly deployed (unhealthy) containers are stopped (`docker compose down`).
        *   The script attempts to use the `joodpakpaw-frontend:backup` image (if it exists) to tag it as the `latest` version.
        *   The containers are then restarted using this backup image, restoring the previous working version of the application.
        *   If no backup image is found, a warning is issued, indicating that manual intervention is required.
    *   The script exits with an error code (1) if the deployment ultimately fails, even after attempting a rollback.

This workflow provides a robust, automated deployment for the frontend, with built-in checks and a crucial rollback mechanism to enhance system reliability.