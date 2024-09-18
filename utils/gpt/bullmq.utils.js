const { Configuration, OpenAIApi } = require('openai');

// Setting up API configuration
const configuration = new Configuration({
  organization: 'org-I6GpFeLkVwOaK4hsRqeZqjEO',
  apiKey: process.env.OPENAI_SECRET_KEY,
});
const openai = new OpenAIApi(configuration);

const parseChatGPTResponseToJson = (data) => {
  const categories = {};
  const regex = /\\n\*\*(.*?)\*\*\\n((?:- .*? - id=\\\".*?\\n)+)/g;
  const matchAllCategories = data.matchAll(regex);

  for (const categoryMatch of matchAllCategories) {
    const categoryName = categoryMatch[1];
    const entries = categoryMatch[2];
    const entryRegex = /- (.*?) - id=\\\"(.*?)\\n/g;
    const matchAllEntries = entries.matchAll(entryRegex);
    categories[categoryName] = [];

    for (const entryMatch of matchAllEntries) {
      categories[categoryName].push({
        name: entryMatch[1],
        id: entryMatch[2],
      });
    }
  }

  return categories;
};

const doStuff = async (keywords, systemPrompt) => {
  // console.log('system prompt', systemPrompt);
  // console.log('keywords', keywords);
  try {
    let messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: keywords.join(', '), // Assuming keywords is an array of strings
      },
    ];

    let object = {
      // model: 'gpt-4-1106-preview',
      // model: 'gpt-4o-2024-05-13',
      model: 'gpt-4o-mini',
      messages: messages,
      response_format: { type: 'json_object' },
    };

    const response = await openai.createChatCompletion(object);
    let description = response.data.choices[0].message.content;
    return description;
    // return JSON.stringify(parseChatGPTResponseToJson(description), null, 4);
  } catch (error) {
    console.error(
      'Error creating keywords from GPT:',
      error.response.data.error
    );
    return null; // or throw an error to be caught by the caller
  }
};

module.exports = { doStuff };
