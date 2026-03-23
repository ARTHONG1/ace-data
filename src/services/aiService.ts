import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey: apiKey || "" });

export async function recommendDatasets(appIdea: string, datasetNames: string[]) {
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }

  const model = "gemini-3-flash-preview";
  
  const prompt = `
    사용자가 이 아이디어로 앱을 개발하려고 합니다: "${appIdea}"
    
    아래는 사용 가능한 공공 데이터셋 목록입니다:
    ${datasetNames.join(", ")}
    
    사용자의 앱 아이디어를 바탕으로 제공된 목록에서 가장 관련성이 높은 상위 5개의 데이터셋 이름을 추천해 주세요.
    추천 결과는 JSON 배열 형식으로 제공하며, 각 객체는 "name"(데이터셋 이름)과 "reason"(관련성 설명)을 포함해야 합니다.
    관련된 데이터셋이 없으면 빈 배열을 반환하세요.
    반드시 제공된 목록에 있는 데이터셋 이름만 사용하세요.
    모든 답변(이유 등)은 한국어로 작성해 주세요.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "당신은 공공 데이터셋과 앱 아이디어를 추천하는 유능한 비서입니다. 모든 답변은 한국어로 작성해야 합니다.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "The recommended dataset name from the provided list." },
              reason: { type: Type.STRING, description: "Brief explanation of why this dataset is relevant to the app idea." }
            },
            required: ["name", "reason"]
          }
        }
      }
    });

    const text = response.text;
    return JSON.parse(text || "[]") as { name: string; reason: string }[];
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

export async function recommendAppsFromDatasets(selectedDatasets: string[], userIdea?: string) {
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }

  const model = "gemini-3-flash-preview";
  
  const prompt = `
    사용자가 다음 공공 데이터셋을 선택했습니다:
    ${selectedDatasets.join(", ")}
    
    ${userIdea ? `사용자의 추가 피드백 및 요구사항: "${userIdea}"\n` : ''}
    
    이 데이터셋들을 바탕으로, 이를 결합하여 만들 수 있는 혁신적이고 실용적인 3가지 앱 아이디어를 제안해 주세요.
    ${userIdea ? '사용자의 피드백을 적극 반영하여 기존 아이디어를 수정하거나 새로운 방향으로 구체화해주세요.' : ''}
    
    결과는 JSON 배열 형식으로 제공하며, 각 객체는 다음을 포함해야 합니다:
    - "title": 앱의 매력적인 이름.
    - "description": 앱의 기능과 선택된 데이터셋을 어떻게 활용하는지에 대한 상세 설명.
    - "value": 이 앱이 사용자에게 주는 핵심 가치 또는 해결하는 문제.
    - "additionalDatasets": 이 앱을 더욱 고도화하기 위해 사용자가 선택한 데이터 외에 추가로 결합하면 좋을 공공데이터포털의 다른 데이터셋 이름들 (2~3개 추천).
    
    모든 답변(제목, 설명, 가치 제안, 추가 데이터셋)은 반드시 한국어로 작성해 주세요.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "당신은 공공 데이터셋을 활용한 창의적인 앱 아이디어 생성기입니다. 사용자의 의도를 파악하여 추가 데이터셋까지 제안하는 지능적인 역할을 수행합니다. 모든 답변은 반드시 한국어로 작성해야 합니다.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "The title of the app idea." },
              description: { type: Type.STRING, description: "Detailed description of the app and dataset usage." },
              value: { type: Type.STRING, description: "The value proposition of the app." },
              additionalDatasets: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "List of other recommended public dataset names to enhance the app."
              }
            },
            required: ["title", "description", "value", "additionalDatasets"]
          }
        }
      }
    });

    const text = response.text;
    return JSON.parse(text || "[]") as { title: string; description: string; value: string; additionalDatasets: string[] }[];
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

export async function searchDatasets(query: string, datasetNames: string[]) {
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }

  const model = "gemini-3-flash-preview";
  
  const prompt = `
    사용자가 다음 검색어로 공공 데이터셋을 찾고 있습니다: "${query}"
    
    아래는 현재 로드된 공공 데이터셋 목록입니다:
    ${datasetNames.join(", ")}
    
    사용자의 검색 의도를 분석하여 가장 관련성이 높은 데이터셋 이름들을 최대 10개까지 선택해 주세요.
    단순한 키워드 매칭뿐만 아니라 의미적으로 유사한 데이터셋도 포함해 주세요.
    결과는 JSON 배열 형식으로 제공하며, 각 객체는 "name"(데이터셋 이름), "relevance"(관련성 점수 0-1), "reason"(매칭된 이유)을 포함해야 합니다.
    관련된 데이터셋이 없으면 빈 배열을 반환하세요.
    반드시 제공된 목록에 있는 데이터셋 이름만 사용하세요.
    모든 분석과 이유는 한국어로 작성해 주세요.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "당신은 공공 데이터셋 검색 전문가입니다. 사용자의 검색 의도를 파악하여 의미적으로 가장 적합한 데이터셋을 찾아주고 그 이유를 설명합니다.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "검색어와 관련 있는 데이터셋 이름" },
              relevance: { type: Type.NUMBER, description: "검색어와의 관련성 점수 (0에서 1 사이)" },
              reason: { type: Type.STRING, description: "이 데이터셋이 검색어와 관련 있는 이유" }
            },
            required: ["name", "relevance", "reason"]
          }
        }
      }
    });

    const text = response.text;
    return JSON.parse(text || "[]") as { name: string; relevance: number; reason: string }[];
  } catch (error) {
    console.error("Error calling Gemini API for search:", error);
    throw error;
  }
}

export async function summarizeData(data: any[]) {
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }

  const model = "gemini-3-flash-preview";
  
  const sampleData = data.slice(0, 20).map(item => ({
    name: item['데이터셋명'] || item['목록명'],
    org: item['제공기관'],
    cat: item['분류']
  }));

  const prompt = `
    다음은 현재 필터링된 공공 데이터셋 목록의 일부(상위 20개)입니다:
    ${JSON.stringify(sampleData)}
    
    이 데이터셋들의 전체적인 특징, 주요 제공 기관, 그리고 이 데이터들을 통해 어떤 인사이트를 얻을 수 있는지 3문장 이내로 요약해 주세요.
    답변은 반드시 한국어로 작성해 주세요.
  `;

  try {
    const response = await genAI.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "당신은 데이터 분석 전문가입니다. 데이터셋 목록을 보고 핵심 내용을 요약해 줍니다.",
      }
    });

    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API for summary:", error);
    throw error;
  }
}
