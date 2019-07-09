
const axios = require('axios');
const querystring = require('querystring');
axios({
            method: 'POST',
            url: "https://paddle-staging-sellers.auth.us-east-1.amazoncognito.com/oauth2/token",
            data: "grant_type=client_credentials&client_id=6f73kj5le66o2vhaadd8n7kch6",
            //data: querystring.stringify({ grant_type: "client_credentials", client_id: "6f73kj5le66o2vhaadd8n7kch6"}),
            headers: { Authorization: 'Basic NmY3M2tqNWxlNjZvMnZoYWFkZDhuN2tjaDY6OGRnMHE5bHUyZTRvY3Y3YXVlM2RjdGt1N3MzOWJpNTE2MHNrMjNxOHUwa3U2ajFuN2xn', "Content-Type":  "application/x-www-form-urlencoded"}
        })
        .then(function (response) {
            // handle success
            console.log(response)
        })
        .catch(function (error) {
            // handle error
            console.log(error)
        });