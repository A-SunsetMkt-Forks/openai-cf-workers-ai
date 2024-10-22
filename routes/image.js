import { uint8ArrayToBase64 } from '../utils/converters';
import { uuidv4 } from '../utils/uuid';
import { streamToBuffer } from '../utils/stream';

export const imageGenerationHandler = async (request, env) => {
    let model = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
    let format = 'b64_json';
    let error = null;
    let created = Math.floor(Date.now() / 1000);
    try {
        if (request.headers.get('Content-Type') === 'application/json') {
            let json = await request.json();
            if (!json?.prompt) {
                throw new Error('no prompt provided');
            }
            if (json?.format) {
                format = json.format;
                if (format !== 'b64_json') {
                    throw new Error('invalid format. must be b64_json');
                }
            }

            const inputs = {
                prompt: json.prompt,
            };

            const respStream = await env.AI.run(model, inputs); // Get the response stream
            const respBuffer = await streamToBuffer(respStream); // Buffer the stream into memory

            if (format === 'b64_json') {
                const b64_json = uint8ArrayToBase64(respBuffer);
                return new Response(JSON.stringify({
                    data: [{ b64_json }],
                    created,
                }), {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
    } catch (e) {
        error = e;
    }

    // if there is no header or it's not json, return an error
    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // if we get here, return a 400 error
    return new Response(JSON.stringify({ error: 'invalid request' }), {
        status: 400,
        headers: {
            'Content-Type': 'application/json'
        }
    });
};
