#!/bin/bash
skupper --platform podman service create redis-server-north 6379 --host-port 6379
skupper --platform podman service create redis-server-west 6379 --host-port 6380
skupper --platform podman service create redis-server-east 6379 --host-port 6381
skupper --platform podman service create redis-sentinel-north 26379 --host-port 26379
skupper --platform podman service create redis-sentinel-west 26379 --host-port 26380
skupper --platform podman service create redis-sentinel-east 26379 --host-port 26381
