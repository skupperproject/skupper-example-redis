#!/bin/bash
skupper expose deployment redis-server --address redis-server-east
skupper expose deployment redis-sentinel --address redis-sentinel-east