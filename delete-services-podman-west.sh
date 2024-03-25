#!/bin/bash
skupper --platform podman service delete redis-server-north
skupper --platform podman service delete redis-server-west 
skupper --platform podman service delete redis-server-east
skupper --platform podman service delete redis-sentinel-north
skupper --platform podman service delete redis-sentinel-west
skupper --platform podman service delete redis-sentinel-east
