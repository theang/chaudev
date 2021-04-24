#!/bin/bash

set -x

rm -rf ./3.0-release
rm -rf ./chaudev_dx@roamingquark.info.xpi
cp -r ./3.0 ./3.0-release
cd 3.0-release
grep -lR 'debug: \?true' | xargs -n1 -I{} sed -i 's/debug: \?true/debug:false/g' {}
zip -r ../chaudev_dx@roamingquark.info.xpi ./* -x '*.eslintrc.yml'
