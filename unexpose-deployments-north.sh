#!/bin/bash
skupper unexpose deployment redis-server --address redis-server-north
skupper unexpose deployment redis-sentinel --address redis-sentinel-north