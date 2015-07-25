#!/bin/bash
export HUBOT_LOG_LEVEL="debug"
export HUBOT_SHELLCMD=scripts/bash/handler
./bin/hubot --adapter slack

