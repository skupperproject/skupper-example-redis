#!/bin/bash
skupper expose deployment redis-server --address redis-server-west
skupper expose deployment redis-sentinel --address redis-sentinel-west