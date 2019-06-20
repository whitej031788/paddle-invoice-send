// Load the axios library for REST requests
const axios = require('axios');
// Load the SDK for JavaScript
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});

// Create DynamoDB service object
const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const docClient = new AWS.DynamoDB.DocumentClient();
const config = require('./config.json');

const cognitoToken = "eyJraWQiOiJySXR3MHphZUpcLzBYYUJ3Q0FNblowekZhXC9TTDQ2UmxLKzJqSmF2SkhnbFE9IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiIwY2U2MWYxNC1lNGE1LTQ2Y2EtYTkxOC1mN2EyYzg3NjY0NjAiLCJldmVudF9pZCI6Ijc3NjZiNTYxLTc2NzgtNDQwMS04MDFmLWI1NGNkOTgyOWMyYiIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE1NjEwMTgyMjcsImlzcyI6Imh0dHBzOlwvXC9jb2duaXRvLWlkcC51cy1lYXN0LTEuYW1hem9uYXdzLmNvbVwvdXMtZWFzdC0xX0g0a09sZTg5QiIsImV4cCI6MTU2MTAyMTgyNywiaWF0IjoxNTYxMDE4MjI3LCJqdGkiOiIxYWZjZjA2MC1iMWU2LTRhYWItOTRiYy1hMjlmM2QwZDMwYWEiLCJjbGllbnRfaWQiOiI0aW9rdDEzbWR0cXJnMDNoY3I0NGNnYzZocCIsInVzZXJuYW1lIjoiMGNlNjFmMTQtZTRhNS00NmNhLWE5MTgtZjdhMmM4NzY2NDYwIn0.FSePVOLWgG2VByZcwMa9HXuNG6cvYhP16WC9ZbZBkRFLdmIohAOCDZbs_LPiXZ09V5qJxT1xg_6-Xevd-xE__Pd8rfk-Q4VY12p4XU6bQatjqgNf1uNY7tEbMViJ6LgBteai2fdttszvLMCTuRNK9-q_dDTDjfLHtUQTdUxDOzCrpzjalbb8r5cBAWESn96bWFCeEo5E9kl2FnsyCc08xyIhKeY-z3LApNgokt_3r7lq8rbBOOKaJeUJMS12tWFru2wjFCrrlGuZeuk3E5bKiLajAg_prE6ER0hBf3-Q5AAV57p8zC6EKnSZwuTJdam1x8ovK3oWocD417Mp3NpzEw";

exports.lambdaHandler = (event, context) => {
    try {
        // The below currenctly successfully gets contracts for a certain day
        // and returns them in the data.Items array; important note, each value is
        // an object as written, like { "S" : "USD" }
        ddb.scan({
            TableName : config.DDB_TABLE_NAME,
            FilterExpression: "contract_start_date = :contract_start_date",
            ExpressionAttributeValues: {
                ":contract_start_date": {
                    "S": formatDate()
                }
            }
        }, function(err, data) {
            if (err) {
                console.log('Error in DynamoDB scan: ', err);
                return err;
            } else {
                console.log('Successfully fetched DynamoDB items, now calling API');
                callPaddleApi(data.Items);
                return data.Items;
            }
        });
    } catch (err) {
        console.log(err);
        return err;
    }
};

const callPaddleApi = (invoices) => {
    for (let i = 0; i < invoices.length; i++) {
        if (!invoices[i].paddle_buyer_id) {
            createBuyerPromiseSingleItem(invoices[i]).then((response) => {
                console.log("Successfully created buyer: ", response);
                // Add new Paddle Buyer ID to the object
                invoices[i].paddle_buyer_id = { "S" : response.data.id};
                createContractPromiseSingleItem(invoices[i]).then((response) => {
                    console.log("Successfully created contract: ", response);
                    invoices[i].paddle_contract_id = { "S" : response.data.id};
                    createPaymentPromiseSingleItem(invoices[i]).then((response) => {
                        console.log("Successfully created payment: ", response);
                        invoices[i].paddle_payment_id = { "S" : response.data.id};
                        // All API calls are done, and we have all the Paddle PK's
                        // on the object, so write it back to DynamoDB
                        generateDynamoObjectFromItemAndSave(invoices[i]);
                    });
                });
            });
        }
    }
}

function generateDynamoObjectFromItemAndSave(item) {
    let params = {
        TableName: config.DDB_TABLE_NAME,
        Key: {
            "id": item.id["S"]
        },
        UpdateExpression: "set paddle_buyer_id = :r, paddle_contract_id = :p, paddle_payment_id = :a",
        ExpressionAttributeValues:{
            ":r": item.paddle_buyer_id["S"],
            ":p": item.paddle_contract_id["S"],
            ":a": item.paddle_payment_id["S"]
        },
        ReturnValues: "UPDATED_NEW"
    };

    docClient.update(params, function(err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
        }
    });
}

function createPaymentPromiseSingleItem(item) {
    return new Promise((resolve, reject) => {
        console.log(formatPaymentItemForPost(item));
        axios({
            method: 'POST',
            url: 'https://vendors.staging.paddle-internal.com/api/2.1/invoicing/payments',
            data: formatPaymentItemForPost(item),
            headers: { Authorization: 'Bearer ' + cognitoToken }
        })
        .then(function (response) {
            // handle success
            return resolve(response.data);
        })
        .catch(function (error) {
            // handle error
            return reject(error);
        });
    });
}

function createContractPromiseSingleItem(item) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'POST',
            url: 'https://vendors.staging.paddle-internal.com/api/2.1/invoicing/contracts',
            data: formatContractItemForPost(item),
            headers: { Authorization: 'Bearer ' + cognitoToken }
        })
        .then(function (response) {
            // handle success
            return resolve(response.data);
        })
        .catch(function (error) {
            // handle error
            return reject(error);
        });
    });
}

function createBuyerPromiseSingleItem(item) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'POST',
            url: 'https://vendors.staging.paddle-internal.com/api/2.1/invoicing/buyers',
            data: formatBuyerItemForPost(item),
            headers: { Authorization: 'Bearer ' + cognitoToken }
        })
        .then(function (response) {
            // handle success
            return resolve(response.data);
        })
        .catch(function (error) {
            // handle error
            return reject(error);
        });
    });
}

function formatPaymentItemForPost(item) {
    let retObj = {};
    retObj.contract_id = parseInt(item.paddle_contract_id["S"]);
    retObj.amount = parseFloat(item.contract_amount["S"]);
    retObj.currency_id = 1; // USD ID, need to map it
    retObj.term_days = parseInt(item.payment_terms["S"]);
    retObj.length_days = 365; // address this
    retObj.status = "draft"; // change to unpaid to send it
    retObj.purchase_order_number = item.purchase_order_number ? item.purchase_order_number["S"] : undefined;
    retObj.product_ids = [parseInt(item.product_id["S"])];
    retObj.passthrough = item.id ? item.id["S"] : undefined; // pass md5 hash for passthrough
    return retObj;
}

function formatContractItemForPost(item) {
    let retObj = {};
    retObj.start_date = item.contract_start_date["S"];
    retObj.end_date = item.contract_end_date["S"];
    retObj.buyer_id = parseInt(item.paddle_buyer_id["S"]);
    return retObj;
}

function formatBuyerItemForPost(item) {
    let retObj = {};
    retObj.name = item.company_name["S"];
    retObj.email = item.company_email["S"];
    // retObj.vat_number = ""; Don't have valid VAT numbers, exclude
    retObj.company_number = item.company_number ? item.company_number["S"] : undefined;
    retObj.address = item.company_address["S"];
    retObj.city = item.company_city["S"];
    retObj.state = item.company_state["S"];
    retObj.postcode = item.company_postcode["S"];
    retObj.country_id = 223; // This is US country_id in our DB, need to create mapping table for this
    return retObj;
}

function formatDate(date) {
    var d = date ? new Date(date) : new Date(),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}