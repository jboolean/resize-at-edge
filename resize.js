/* eslint-disable @typescript-eslint/no-var-requires */
const sharp = require('sharp');
const axios = require('axios');
const querystring = require('querystring');
const get = require('lodash/get');

module.exports.handler = async event => {
  console.log(JSON.stringify(event, undefined, '  '));
  const request = event.Records[0].cf.request;
  
  const origin = request.origin.custom || request.origin.s3;
  const accept = get(request, 'headers.accept[0].value') || '';

  const originUrl = `${origin.protocol}://${origin.domainName}${origin.path}${request.uri}`;
  
  const params = querystring.parse(request.querystring);

  // Pass through requests without param
  if (!params.width) return request;

  try {
    const resp = await axios.get(originUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(resp.data);
    let width;
    if (params.width === 'full') width = undefined;
    else width = parseInt(params.width, 10);

    let compressed;
    let contentType;

    if (accept.includes('image/webp')) {
      compressed = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .webp()
        .toBuffer();
      contentType = 'image/webp';
    } else {
      compressed = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .jpeg({ progressive: true })
        .toBuffer();
      contentType = 'image/jpeg';
    } 

    return {
      body: compressed.toString('base64'),
      bodyEncoding: 'base64',
      headers: {
        'content-type': [
          {
            key: 'Content-Type',
            value: contentType,
          },
        ],
        'access-control-allow-origin': [{
          key: 'Access-Control-Allow-Origin',
          value: '*'
        }]
      },
      status: '200',
      statusDescription: 'Recompressed',
    };
  } catch (err) {
    if (err.response) {
      return {
        body: err.response.body,
        bodyEncoding: 'text',
        headers: {},
        status: err.response.status,
        statusDescription: err.message,
      };
    }
    console.error(err);
    return {
      body: JSON.stringify(err),
      bodyEncoding: 'text',
      headers: {},
      status: 500,
      statusDescription: err.message,
    };
  }

};
