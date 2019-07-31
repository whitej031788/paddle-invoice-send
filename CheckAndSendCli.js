/*
TO DO:
Mappings for country_id and currency_id
Auto generate cognito token
Catch webhooks
Determine contract_start_date offset for finding/sending
Change status to unpaid from draft
*/
// Load the axios library for REST requests
const axios = require('axios');
// Load the SDK for JavaScript
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-2'});

// Create DynamoDB service object
const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
const docClient = new AWS.DynamoDB.DocumentClient();
const config = require('./config.json');

let cognitoToken = "";

try {
    // The below currenctly successfully gets contracts for a certain day
    // and returns them in the data.Items array; important note, each value is
    // an object as written, like { "S" : "USD" }
    ddb.scan({
        TableName : config.DDB_TABLE_NAME,
        FilterExpression: "contract_start_date = :contract_start_date",
        ExpressionAttributeValues: {
            ":contract_start_date": {
                "S": formatDate() // Leave empty for TODAY's date
            }
        }
    }, function(err, data) {
        if (err) {
            console.log('Error in DynamoDB scan: ', err);
            return err;
        } else {
            console.log('Successfully fetched DynamoDB items, now calling API');
            generateAuthToken().then((response) => {
                console.log(response);
                cognitoToken = response.access_token;
                callPaddleApi(data.Items).then((response) => {
                    console.log(response);
                    return response;
                });
            })
            .catch(function (error) {
                // handle error
                console.log(error)
            });;
        }
    });
} catch (err) {
    console.log(err);
    return err;
}

const callPaddleApi = async (invoices) => {
    try {
        for (let i = 0; i < invoices.length; i++) {
            if (!invoices[i].paddle_buyer_id) {
                await topLevelPromise(invoices[i]).then((response) => {
                    console.log("Successfully create invoice and updated DynamoDB: ", response);
                });
            }
        }
        return {status: "success", invoiceCount: invoices.length};
    } catch(error) {
        console.error(error);
        return error;
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

function topLevelPromise(item) {
    return new Promise((resolveFinally, reject) => {
        createBuyerPromiseSingleItem(item).then((response) => {
            console.log("Successfully created buyer: ", response);
            // Add new Paddle Buyer ID to the object
            item.paddle_buyer_id = { "S" : response.data.id};
            createContractPromiseSingleItem(item).then((response) => {
            console.log("Successfully created contract: ", response);
            item.paddle_contract_id = { "S" : response.data.id};
                createPaymentPromiseSingleItem(item).then((response) => {
                    console.log("Successfully created payment: ", response);
                    item.paddle_payment_id = { "S" : response.data.id};
                    // All API calls are done, and we have all the Paddle PK's
                    // on the object, so write it back to DynamoDB
                    generateDynamoObjectFromItemAndSave(item);
                    resolveFinally(item);
                });
            });
        });
    });
}

function generateAuthToken() {
    return new Promise((resolve, reject) => {
        axios({
            method: 'POST',
            url: config.OAuthURL,
            data: "grant_type=client_credentials&client_id=6f73kj5le66o2vhaadd8n7kch6",
            headers: { Authorization: 'Basic NmY3M2tqNWxlNjZvMnZoYWFkZDhuN2tjaDY6OGRnMHE5bHUyZTRvY3Y3YXVlM2RjdGt1N3MzOWJpNTE2MHNrMjNxOHUwa3U2ajFuN2xn', "Content-Type":  "application/x-www-form-urlencoded"}
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

function createPaymentPromiseSingleItem(item) {
    return new Promise((resolve, reject) => {
        console.log(formatPaymentItemForPost(item));
        axios({
            method: 'POST',
            url: config.paddleApiURL + '/api/2.1/invoicing/payments',
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
            url: config.paddleApiURL + '/api/2.1/invoicing/contracts',
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
            url: config.paddleApiURL + '/api/2.1/invoicing/buyers',
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
    retObj.status = "unpaid"; // change to unpaid to send it
    retObj.purchase_order_number = item.purchase_order_number ? item.purchase_order_number["S"] : undefined;
    retObj.products = [
        {
            id: parseInt(item.product_id["S"]),
            additional_information: "This is additional information"
        }
    ];
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