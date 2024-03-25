#!/bin/bash
skupper expose deployment redis-server --address redis-server-north
skupper expose deployment redis-sentinel --address redis-sentinel-north