const PIPELINE_ID = "64392f96daac500b55c543cd";

const CONFIG_URL =
  "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";

const CONFIG_TTL_MS = 5 * 60_000;

type TaskType = "tts" | "transliteration";

interface PipelineAuth {
  callbackUrl: string;
  headerName: string;
  headerValue: string;
}

interface ConfigCacheEntry {
  auth: PipelineAuth;
  serviceId: string;
  expiresAt: number;
}

interface PipelineComputeResponse {
  pipelineResponse?: Array<{
    output?: Array<{ source: string; target?: string[] }>;
    audio?: Array<{ audioContent?: string | null }>;
  }>;
}

const configCache = new Map<string, ConfigCacheEntry>();

export function bhashiniEnabled(): boolean {
  return Boolean(
    process.env.BHASHINI_USER_ID && process.env.BHASHINI_ULCA_API_KEY
  );
}

function cacheKey(taskType: TaskType, src: string, tgt?: string): string {
  return `${taskType}:${src}${tgt ? `:${tgt}` : ""}`;
}

async function fetchConfig(
  taskType: TaskType,
  src: string,
  tgt?: string
): Promise<ConfigCacheEntry> {
  const userId = process.env.BHASHINI_USER_ID!;
  const apiKey = process.env.BHASHINI_ULCA_API_KEY!;

  const language: Record<string, string> = { sourceLanguage: src };
  if (tgt) language.targetLanguage = tgt;

  const res = await fetch(CONFIG_URL, {
    method: "POST",
    headers: {
      userID: userId,
      ulcaApiKey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pipelineTasks: [{ taskType, config: { language } }],
      pipelineRequestConfig: { pipelineId: PIPELINE_ID },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`bhashini config ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const end = data?.pipelineInferenceAPIEndPoint;
  if (
    !end?.callbackUrl ||
    !end?.inferenceApiKey?.name ||
    !end?.inferenceApiKey?.value
  ) {
    throw new Error("bhashini config: missing inference endpoint");
  }

  const tasks = data?.pipelineResponseConfig ?? [];
  const task = tasks.find((t: { taskType: string }) => t.taskType === taskType);
  const entry = (task?.config ?? []).find(
    (c: {
      language?: { sourceLanguage?: string; targetLanguage?: string };
      serviceId?: string;
    }) =>
      c?.language?.sourceLanguage === src &&
      (!tgt || c?.language?.targetLanguage === tgt)
  );

  if (!entry?.serviceId) {
    throw new Error(
      `bhashini config: no ${taskType} model for ${src}${tgt ? `->${tgt}` : ""}`
    );
  }

  return {
    auth: {
      callbackUrl: end.callbackUrl,
      headerName: end.inferenceApiKey.name,
      headerValue: end.inferenceApiKey.value,
    },
    serviceId: entry.serviceId,
    expiresAt: Date.now() + CONFIG_TTL_MS,
  };
}

async function getOrFetchConfig(
  taskType: TaskType,
  src: string,
  tgt?: string
): Promise<ConfigCacheEntry> {
  const key = cacheKey(taskType, src, tgt);
  const hit = configCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit;
  const entry = await fetchConfig(taskType, src, tgt);
  configCache.set(key, entry);
  return entry;
}

async function computeWithRetry(
  taskType: TaskType,
  src: string,
  tgt: string | undefined,
  payload: unknown
): Promise<PipelineComputeResponse> {
  const key = cacheKey(taskType, src, tgt);

  const attempt = async (): Promise<PipelineComputeResponse> => {
    const entry = await getOrFetchConfig(taskType, src, tgt);
    const res = await fetch(entry.auth.callbackUrl, {
      method: "POST",
      headers: {
        [entry.auth.headerName]: entry.auth.headerValue,
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(
        `bhashini compute ${res.status}: ${body.slice(0, 300)}`
      ) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return (await res.json()) as PipelineComputeResponse;
  };

  try {
    return await attempt();
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      configCache.delete(key);
      return attempt();
    }
    throw err;
  }
}

async function transliterateToTamil(text: string): Promise<string> {
  const data = await computeWithRetry("transliteration", "en", "ta", {
    pipelineTasks: [
      {
        taskType: "transliteration",
        config: {
          language: { sourceLanguage: "en", targetLanguage: "ta" },
          serviceId: "ai4bharat/indicxlit--cpu-fsv2",
          isSentence: true,
        },
      },
    ],
    inputData: { input: [{ source: text }] },
  });

  const first = data?.pipelineResponse?.[0];
  const target = first?.output?.[0]?.target?.[0];
  return typeof target === "string" && target.length > 0 ? target : text;
}

export async function bhashiniTts(
  text: string,
  voice: "male" | "female"
): Promise<Buffer> {
  let tamilText: string;
  try {
    tamilText = await transliterateToTamil(text);
  } catch (err) {
    console.error("[lyra-tts] transliteration failed, using raw text:", err);
    tamilText = text;
  }

  const data = await computeWithRetry("tts", "ta", undefined, {
    pipelineTasks: [
      {
        taskType: "tts",
        config: {
          language: { sourceLanguage: "ta" },
          serviceId: "ai4bharat/indic-tts-coqui-dravidian-gpu--t4",
          gender: voice,
          speed: 1.0,
        },
      },
    ],
    inputData: { input: [{ source: tamilText }] },
  });

  const audioContent =
    data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
  if (typeof audioContent !== "string" || !audioContent) {
    throw new Error("bhashini tts: no audio content in response");
  }
  return Buffer.from(audioContent, "base64");
}
