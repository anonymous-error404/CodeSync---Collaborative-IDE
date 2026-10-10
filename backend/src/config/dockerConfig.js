import 'dotenv/config';

/** Docker image to use per language (overridable via .env) */
export const DOCKER_IMAGES = {
  node:   process.env.DOCKER_IMAGE_NODE   || 'node:22-alpine',
  python: process.env.DOCKER_IMAGE_PYTHON || 'python:3.12-alpine',
  java:   process.env.DOCKER_IMAGE_JAVA   || 'eclipse-temurin:21-jdk-alpine',
};

/** Resource limits (overridable via .env) */
export const DOCKER_MEMORY_LIMIT = process.env.DOCKER_MEMORY_LIMIT || '128m';
export const DOCKER_CPU_LIMIT    = process.env.DOCKER_CPU_LIMIT    || '0.5';

/** Prefix for container names — used to kill by name */
export const CONTAINER_NAME_PREFIX = 'codesync-exec';
