import { Readable } from 'node:stream';
import { createToolCallObject } from './utils/responseGenerators.js';

export function createChatStream(requestBody) {
  const stream = new Readable({ read() {} });
  const created = Math.floor(Date.now() / 1000);
  const isToolCall = Array.isArray(requestBody.tools);
  const toolCall = isToolCall ? createToolCallObject(requestBody) : null;

  const chunks = [];

  if (isToolCall) {
    // Break tool call into realistic streaming chunks
    const baseChunk = {
      id: `chatcmpl-${created}`,
      object: 'chat.completion.chunk',
      created,
      model: 'gpt-3.5-mock',
      system_fingerprint: null,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null,
        },
      ],
    };

    // Chunk 1: start tool call with name
    chunks.push({
      ...baseChunk,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: toolCall.function.name,
                },
              },
            ],
          },
        },
      ],
    });

    // Chunk 2+: stream function.arguments as string
    const args = toolCall.function.arguments;
    const argParts = args.match(/.{1,20}/g); // break into chunks of 20 chars

    for (const part of argParts) {
      chunks.push({
        ...baseChunk,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  function: {
                    arguments: part,
                  },
                },
              ],
            },
          },
        ],
      });
    }

    // Final empty delta to close
    chunks.push({
      ...baseChunk,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'tool_calls',
        },
      ],
    });
  } else {
    // Normal content streaming fallback
    const words = ["Here's ", 'a ', 'response.'];
    for (const word of words) {
      chunks.push({
        id: `chatcmpl-${created}`,
        object: 'chat.completion.chunk',
        created,
        model: 'gpt-3.5-mock',
        choices: [
          {
            index: 0,
            delta: { content: word },
            finish_reason: null,
          },
        ],
      });
    }
    chunks.push({
      id: `chatcmpl-${created}`,
      object: 'chat.completion.chunk',
      created,
      model: 'gpt-3.5-mock',
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    });
  }

  let i = 0;
  const sendNext = () => {
    if (i < chunks.length) {
      stream.push(`data: ${JSON.stringify(chunks[i])}\n\n`);
      i++;
      setTimeout(sendNext, 150);
    } else {
      stream.push(`data: [DONE]\n\n`);
      stream.push(null);
    }
  };

  sendNext();
  return stream;
}
