#!/bin/sh
SOURCE="../dist/daga-tutorial/browser"
TARGET=risk.metadev.pro
REGION=eu-south-2


npm run build &&
  ./deploy-to-s3.sh $SOURCE s3://${TARGET} $REGION &&
  aws s3api put-bucket-cors --bucket $TARGET --cors-configuration file://pro-cors.json --region $REGION
