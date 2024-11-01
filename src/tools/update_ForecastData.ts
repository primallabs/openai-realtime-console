import OpenAI from "openai";
const openai = new OpenAI();

var ToolSchema = {
    name: 'update_ForecastData',
    description: 'Fetches most current data to forecast with.'
  };

var ToolFunction =
  async ({ }: { [key: string]: any }) => {
    /// Exmaple of a function calling an endpoint
    const result = await fetch('https://api.example.com/data');
    const json = await result.json();
    return json;
  }