#!/bin/bash

sam package --output-template-file packaged.yaml --s3-bucket paddle-invoice-send

sam deploy \
    --template-file packaged.yaml \
    --stack-name paddle-invoice-send \
    --capabilities CAPABILITY_IAM \
    --region us-east-2 \
    --parameter-overrides NotificationEmail=jamie@paddle.com