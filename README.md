# azure-openai-resume-parser

# 📄 Azure OpenAI Resume Parser API

Esta es una API construida en **Node.js**, desplegada en **Docker**, diseñada para extraer información estructurada desde CVs en formato **PDF o Word**, utilizando **Azure OpenAI** (GPT-4o mini) y la librería **LangChain**. Ideal para integrarse en herramientas como **Retool** o para automatizar procesos de selección.

---

## 🚀 Funcionalidad principal

1. Recibe un `pdfpath` como URL del documento a analizar (PDF o DOCX).
2. Usa Azure OpenAI para analizar su contenido y extraer:
   - Datos personales
   - Experiencia profesional
   - Educación, idiomas, certificaciones, habilidades, etc.
3. Devuelve un JSON estructurado validado con `Zod`.
4. Corre dentro de un contenedor Docker.

---

## 🧠 Ejemplo de uso

### Request (POST a `/completions`):

```json
{
  "pdfpath": "https://ruta-al-documento.com/cv.pdf",
  "nifparam": "12345678A",
  "docname": "juan_garcia_cv"
}
````
---
### Response:

````json
{
  "people": [
    {
      "employeid": "438482",
      "name": "Juan García",
      "email": "juan@email.com",
      "summary": "Desarrollador con experiencia en...",
      "professional_experience": [...],
      "education": [...],
      "skills": {
        "technical": [
          { "name": "JavaScript", "years": 3 },
          { "name": "SQL", "years": 4 }
        ],
        "soft": ["Trabajo en equipo", "Comunicación"]
      }
    }
  ]
}
````
---
### ⚙️ Cómo ejecutarlo con Docker

1. Clona este repositorio:

 - git clone https://github.com/tu_usuario/azure-openai-resume-parser.git
 - cd azure-openai-resume-parser

2.  Crea un archivo .env o ajusta las variables de entorno en docker-compose.yml.

3.  Levanta los servicios:
 - docker-compose up --build -d
 - La API estará disponible en: http://localhost:3555/completions

---
### 🌐 Variables de entorno necesarias

  Estas se definen en docker-compose.yml:

  - AZURE_OPENAI_API_KEY

  - AZURE_OPENAI_ENDPOINT

  - AZURE_OPENAI_DEPLOYMENT_NAME

  - AZURE_OPENAI_API_VERSION

  - AZURE_MODEL_NAME
---
### 📦 Estructura del proyecto

````
azure-openai-resume-parser/
├── index.js               # Lógica principal de la API
├── Dockerfile             # Imagen de Docker
├── docker-compose.yml     # Orquestación del contenedor
├── package.json           # Dependencias
````
---
### 📄 Licencia

MIT. Puedes modificar y usar libremente este proyecto.
---
### ✍️ Autor

Desarrollado por Juan Rodríguez (@LittleWiseGuy93) para proyectos internos de análisis de CVs usando IA.
---
