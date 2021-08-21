"use strict";

/*
  The @serverless/cloud package is included by default in the cloud runtime.
  So you don't have to include it in package.json.
  
  Use 'api' to build REST APIs, 'data' to access Serverless Data, and 'schedule'
  to create scheduled tasks.

  If you want to serve up static assets, just put them in the '/static' folder
*/
// @ts-ignore
import { api, data } from "@serverless/cloud"; // eslint-disable-line
import { v4 as uuid } from 'uuid';
import axios from "axios";
import cors from 'cors';

api.use(cors());

const API_KEY = "XXX";
const TTT_AND_JITA = 2;

// const options: cors.CorsOptions = {
//   origin: 'http://localhost:3000',
//   methods: "GET,HEAD,PUT,POST,DELETE"
// };

// api.use(cors(options));
api.options('*', cors());

api.post('/appraisal', async (req, res) => {
  // ts
  const body = req.body;
  console.log({body});
  const r = await appraiseRawText(body.text);
  console.log(r);
  res.send(r);
});

async function appraiseRawText(text: string): Promise<{items: any[], price: number, volume: number}> {
  console.log({text});
  try {
    const response = await axios.post(`https://janice.e-351.com/api/rest/v1/appraisal?key=${API_KEY}&market=${TTT_AND_JITA}&designation=100&pricing=100&persist=false`, text, {
      headers: {'Content-Type': 'text/plain'}
    });
    console.log(response.data);
    return {
      items: response.data.items,
      price: response.data.totalSellPrice,
      volume: response.data.totalVolume,
    };
  } catch (e) {
    console.log(e);
    throw e;
  }
}

api.get('/orders', async (req, res) => {

  // Call our getTodos function with the status
  const result = await getOrders(req.query.status);

  // Return the results
  res.send(result);
});

api.get('/orders/:id', async (req, res) => {

    const result = await getOrder(req.params.id);

    if (!result) {
      // todo: send error code when result is undefined
      res.status(404).end();
    } else {
      res.send(result);
    }
});

api.put('/orders/:id', async (req, res) => {
  // todo: secure this route

  const { body } = req;
  const { id } = req.params;
  const order = await getOrder(id);

  if (order.status !== 'pending') {
    // res.status(400).end();
    res.status(400).send('');
  }

  const result = {
    ...order,
    ...body,
    id,
  };

  await data.set(
      `order:${id}`,
      result,
      {
        label1: result.status,
      }
  );

  // Return the results
  res.send(result);
});

api.post('/orders/', async (req, res) => {

  console.log(new Date().toISOString());

  const { body } = req;

  const id = uuid();
  const order = {
      ...body,
    status: 'pending',
      id,
  };

  await data.set(
    `order:${id}`,
    order,
      {
        label1: 'pending',
      }
  );

  // Return the updated list of TODOs
  res.send(order);
});

const oauthClient = axios.create({
  baseURL: 'https://login.eveonline.com/oauth',
  timeout: 5000,
  headers: {
    'User-Agent': 'Rihan Shazih - newedendeliveries.space',
    'Content-Type': 'application/json'
  }
});


// todo: try to put them into parameters
const EVE_CLIENT_ID = 'XXX';
const EVE_CLIENT_SECRET = 'XXX';

api.post('/auth', async (req, res) => {
  const {body: input} = req;
  console.log({input});

  const authenticationResponse = await oauthClient.post('/token', {
    'grant_type': 'authorization_code',
    code: input.code
  }, {
    headers: {
      'Authorization': `Basic ${Buffer.from(`${EVE_CLIENT_ID}:${EVE_CLIENT_SECRET}`).toString('base64')}`
    }
  });

  console.log({authentication: authenticationResponse.data});
  const {refresh_token: refreshToken} = authenticationResponse.data;

  const characterAuthResponse = await oauthClient.get('/verify', {
    headers: {
      "Authorization": `Bearer ${authenticationResponse.data.access_token}`
    }
  });
  console.log({characterAuth: characterAuthResponse.data});

  const {CharacterID: characterId, CharacterName: characterName, CharacterOwnerHash: ownerHash} = characterAuthResponse.data;

  const ownerId: number = characterAuthResponse.data.CharacterID;

  await data.set(`${ownerId}:token`, {
    characterId,
    characterName,
    ownerHash,
    refreshToken,
  });

  console.log('wrote token');

  // const tokenContent = {
  //   sub: ownerId,
  //   // validity: thirty days
  //   exp: Math.floor(new Date().getTime() / 1000 + 86400 * 30),
  //   aud: 'user',
  // };

  // TODO: TypeError: jwt.sign is not a function
  // const token = jwt.sign(tokenContent, JWT_SECRET);
  // console.log({token});

  // looks like the result is not sent back
  res.send({token: 'ok'});
});

api.delete('/orders/:id', async (req, res) => {
  await data.remove(`order:${req.params.id}`)
  res.status(204).json({deleted: 'ok'});
});


// serve SPA until we have support
api.get('*', (req, res) => {
  res.sendFile(__dirname + '/static/index.html')
});

/*
  This is some custom error handler middleware
*/
// eslint-disable-next-line
api.use((err, req, res, next) => {
  // Errors are also streamed live to your terminal in dev mode.
  console.error(err.stack);

  if (!err.statusCode) {
    err.statusCode = 500;
  }

  const error = {
    name: err.name,
    statusCode: err.statusCode,
    message: err.message,
  };

  res.status(err.statusCode).json(error);
});

const getOrder = async (id: string) => {
    return await data.get(`order:${id}`);
}

/*
  This is our getTodos function that we can reuse in different API paths 
*/
const getOrders = async (status: string) => {
  let result;
  if (!status) {
    result = await data.get('order:*');
  } else {
    result = await data.getByLabel('label1',`${status}:*`);
  }

  return {
    items: result.items
        .map(item => item.value)
        .sort((a, b) => a.id.localeCompare(b.id))
  }
}