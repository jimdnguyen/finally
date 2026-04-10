#!/bin/bash
docker rm -f finally-app 2>/dev/null && echo "FinAlly stopped." || echo "FinAlly was not running."
