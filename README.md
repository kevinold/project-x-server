# project-x-server

## Architecture

There is a REST API (API Gateway) which provides two API to begin/complete the OAuth process and handle incoming webhook calls from Shopify. After completeing the OAuth process the user receives a token they can use to log into Cognito User Pools. This will provide them access to the main GraphQL API (AppSync) which reads and writes directly to DynamoDB.

Any tasks that can be performed asynchronously (like setting up webhooks/script tags after authentication or processing webhook requests) are done inside Lambda that are triggered by messages published to an SNS queue. These Lambda each perform a single task because SNS allows you to fan out messages triggering mulitple Lambda in response to a single event.

## Lambda Functions

### appUninstalled

This Lamdba is triggered via the app uninstalled SNS topic when the user uninstalls the application. It removes the stores record from the shops table so that when the application is reinstalled it gets a fresh installation.

While it is possible to modify this Lambda to perform additional work it is better to either

- Create a new Lambda that watches the shops table DynamoDB stream for delete events
- Create a new Lambda that also listens to the app uninstalled SNS topic

### authBegin

This Lambda is triggered via an HTTP event and begins the OAuth process. It returns a token use in the authComplete Lambda and a redirect URL to authenticate the users.

### authComplete

This Lambda is triggered via an HTTP event and completes the OAuth process. In aditional to completing the OAuth process this Lambda also

- Adds a new record to Cognito User Pools for the store if one doesn't exist
- Adds a new record or updates an existing record in the shops table with the store domain and accessToken.
- Starts the OAuth complete step function
- Returns a token that can be used to log into Cognito User Pools

### createAuthChallenge

Create a custom authentication challenge. This is used to allow passwordless login to Cognito Users Pools by the stores.

### defineAuthChallenge

Define the authenticaiton challenge process. This is used to allow password login to Cognito Users Pools by the store.

### getShopSettings

This Lambda is triggered by the OAuth complete step function. It retrieves the shop information from Shopify and updates the shops record in DynamoDB to be more complete. After this has been done it publishes a message to the app installed topic indicating the application has been installed.

### preSignUp

This automatically validates any Shopify user accounts in Cognito User Pools

### scriptTagsManager

This Lambda is responsible for setting up scriptTags that are configured for the application. It is triggered by the OAuth complete step function.

### shopUpdate

This Lambda handles shop/update webhooks from Shopify. It is triggered by the webhooksHander Lambda when it publishes an message to the shop update SNS topic. This Lambda's job is to keep the shops table record for the store up to date.

### verifyAuthChallengeResponse

This validates the token returned by authComplete when the user presents it to login in to Cognito User Pools. It is part of the passwordless authentication process.

### webhooksHandler

Receives all of the webhooks from Shopify. After validating the webhook it looks up the relevant SNS topic for that webhook from the config then pushes the message to that topic. Other Lambda functions listen to those topics then process the messages (actually handling the incoming webhook). This approach allows multiple Lambda functions to handle a single incoming webhook and allows you to handle new webhooks without needing to modify existing functions.

### webhooksManager

This Lambda is responsible for setting up webhooks that are configure for the application. The actual webhooks are handled by the webhooksHandler Lambda. This lambda is triggered by the OAuth complete step function

## SNS Topics

SNS messages are used to deliver

### Default Topics

These topics are configured by default.

#### app-uninstalled (appUninstalledTopic)

A message is published to this topic after the app has been removed from the store in Shopify

#### shop-update (shopUpdateTopic)

A message is published to this topic after the store settings have been updated in Shopify

### Aditional Topics

In addition to the default topics you can add custom topics. The main reason you will want to do this is to support additional webhooks. Start by adding your new Lambda and configuring it to subscribe to your new SNS topic. Then add a new webhook in the config file with that topic as the `snsTopicArn`. The next time the user completes the login process it will add the new webhook on the store. Incoming webhooks will be handled by the webhooksHandler Lambda which will publish the message to the relevant SNS topic. This will trigger your new Lambda.

## GraphQL Schema and TypeScript Interfaces

Both GraphQL and TypeScript are strongly typed. By keeping the GraphQL queries in `.graphql` files in the `src/graphql` folder we can take advantage of this.

To begin you need to download a copy of the GraphQL schema in JSON format. This can be done with the command:

```sh
apollo-codegen introspect-schema https://apikey:password@your-store.myshopify.com/admin/api/graphql.json --output schema.json
```

The `apikey` and `password` parameters you can get by creating a private application in your development store.

Once you have that you can generate Typescript interfaces for each of the queries, mutations and fragments in your `.graphql` files by running the the command:

```sh
apollo-codegen generate src/**/*.graphql --schema schema.json --target typescript --output src/schema.ts
```

This will check your queries against the schema and display any errors then generate Typescript interfaces that match your queries. By using the interfaces inside your code you get a number of benefits.

* Autocompletion inside your IDE when accessing data returned by the API
* Errors if you attempt to use information that wasn't requested
* Errors if you don't pass enough parameters
* Correct type information for attributes
