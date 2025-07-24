const express = require("express");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
const pptxParser = require("pptx-parser");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
app.use(express.json());

const SYSTEM_PROMPT = `
Eres un analista experto en extracción de información documental.

Tu objetivo es leer un único PDF o PPTX (en español) que describe una oferta comercial y devolver
EXCLUSIVAMENTE un objeto JSON con los siguientes campos.
No añadas comentarios, texto extra ni formato Markdown: solo el JSON.

### Campos obligatorios

| Campo                              | Tipo                                   | Detalles / Reglas de validación                                                  |
|-----------------------------------|----------------------------------------|----------------------------------------------------------------------------------|
| nombre_doc                        | string                                 | Nombre del archivo original (con extensión).                                     |
| cliente                           | string                                 | Razón social del cliente (en español tal cual aparezca).                         |
| tecnologias                       | array<string>                          | Lista de tecnologías/herramientas citadas. Sin repetidos, sin versiones.         |
| fechaEntrega                      | string (ISO 8601)                      | Fecha prevista de entrega. Si faltan día/mes usa 01.                             |
| descripcion                       | string                                 | Resumen de la oferta (máx. 280 caracteres).                                      |
| areaEmpresa                       | string                                 | Área interna responsable (TI, Finanzas, etc.).                                   |
| personasReferenciaCliente         | array<string>                          | Nombres propios, sin cargos.                                                     |
| personasReferenciaAtmira          | array<string>                          | Nombres propios, sin cargos.                                                     |
| tipoDeContrato                    | string                                 | Enum: proyecto | TM | formación | otro.                                         |
| perfilesOfertados                 | array<string>                          | Perfiles solicitados (ej.: "Desarrollador Java").                                |
| propuestaEconomica                | array<number>                          | Valores numéricos (sin símbolo € ni separador de miles; usa punto decimal).      |
| alcanceTemporalPropuestaUnidad    | string                                 | Enum: días | meses | años.                                                     |
| alcanceTemporalPropuesta          | number                                 | Valor numérico de la unidad anterior.                                            |
| urlDocumento                      | string (URL)                           | Debe ser exactamente: <URL_DOCUMENTO> pero reemplazando file-upload-api:4000 por vmcurripre01.atmira.global:4000 |

### Instrucciones de extracción

1. No inventes información. Si un campo no existe o no puedes inferirlo con alta certeza, omite el campo.
2. No repitas valores ni introduzcas duplicados en arrays.
3. Corrige erratas menores de tildes u ortografía si las detectas.
4. Todo el texto (salvo nombres propios, nombres de empresas y tecnologías) debe estar en español.
5. Asegúrate de que la salida sea un JSON válido y mínimamente formateado.

Recuerda: devuelve solo el JSON.
`;

// Funciones para cargar documentos

async function loadPDF(pdfURL) {
  const response = await fetch(pdfURL);
  const blob = await response.blob();
  const loader = new PDFLoader(blob, { splitPages: false });
  const docs = await loader.load();
  if (docs.length === 0) throw new Error("No se pudo cargar el PDF.");
  return docs[0].pageContent;
}

async function loadPPTX(pptxURL) {
  const response = await fetch(pptxURL);
  const buffer = await response.arrayBuffer();
  const slides = await pptxParser.parse(Buffer.from(buffer));
  const text = slides.map(slide => slide.texts.map(t => t.text).join("\n")).join("\n\n");
  if (!text) throw new Error("No se pudo extraer texto del PPTX.");
  return text;
}

async function loadDocumentAuto(url) {
  const ext = path.extname(url).toLowerCase();
  if (ext === ".pdf") {
    return await loadPDF(url);
  } else if (ext === ".pptx") {
    return await loadPPTX(url);
  } else {
    throw new Error("Formato no soportado: " + ext);
  }
}

app.post("/extract", async (req, res) => {
  try {
    const fileURL = req.body.fileURL || req.body.pdfURL;
    if (!fileURL) return res.status(400).json({ error: "Falta parámetro fileURL o pdfURL" });

    const nombreDoc = decodeURIComponent(path.basename(fileURL));
    const urlDocumento = fileURL.replace("file-upload-api:4000", "vmcurripre01.atmira.global:4000");

    const content = await loadDocumentAuto(fileURL);

    const promptWithVars = SYSTEM_PROMPT
      .replace(/<URL_DOCUMENTO>/g, urlDocumento)
      .replace(/<URL_DEL_DOCUMENTO>/g, urlDocumento)
      .replace(/<URL_DEL_PDF>/g, urlDocumento);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", promptWithVars],
      ["human", content]
    ]);

    const llm = new ChatOpenAI({
      azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_ENDPOINT,
      azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
      modelName: process.env.AZURE_MODEL_NAME,
      temperature: 0,
    });

    const result = await prompt.pipe(llm).invoke({});
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(result.content);
    } catch {
      const match = result.content.match(/\{[\s\S]*\}/);
      jsonResponse = match ? JSON.parse(match[0]) : { error: "No se pudo extraer JSON." };
    }

    if (jsonResponse) {
      jsonResponse.nombre_doc = jsonResponse.nombre_doc || nombreDoc;
      jsonResponse.urlDocumento = urlDocumento;
    }

    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error interno en el servidor", error: error.message });
  }
});

app.listen(3555, () => {
  console.log("Servidor corriendo en el puerto 3555");
});
