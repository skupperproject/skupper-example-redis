#!/bin/bash
skupper unexpose deployment redis-server --address redis-server-east
skupper unexpose deployment redis-sentinel --address redis-sentinel-east