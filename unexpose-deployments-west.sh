#!/bin/bash
skupper unexpose deployment redis-server --address redis-server-west
skupper unexpose deployment redis-sentinel --address redis-sentinel-west