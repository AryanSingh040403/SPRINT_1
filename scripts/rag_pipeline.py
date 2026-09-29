import os
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

# --- Configuration ---
# CRITICAL: Make sure this path points to wherever your notes file actually lives!
NOTES_PATH = "../data/domain_docs/arch_notes.txt" 
FAISS_SAVE_PATH = "../models/faiss_index_local"

def build_rag_database():
    print(f"📄 Loading document: {NOTES_PATH}...")
    
    # 1. Load the document
    try:
        loader = TextLoader(NOTES_PATH)
        documents = loader.load()
    except FileNotFoundError:
        print(f"\n❌ ERROR: Could not find '{NOTES_PATH}'.")
        print("Please check the NOTES_PATH variable at the top of this script and make sure it points to your text file.\n")
        return

    # 2. Chunk the document (600 size, 100 overlap based on your Lolo V4 Architecture)
    print("✂️ Chunking text...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=100,
        length_function=len,
        is_separator_regex=False,
    )
    chunks = text_splitter.split_documents(documents)
    print(f"✅ Created {len(chunks)} chunks.")

    # 3. Create Embeddings
    print("🧠 Initializing Embedding Model (all-MiniLM-L6-v2)...")
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"}
    )

    # 4. Build and Save the FAISS Vector Database
    print("🏗️ Building FAISS Vector Database...")
    vector_store = FAISS.from_documents(chunks, embeddings)
    
    # Ensure the models directory exists so we don't throw a folder error
    os.makedirs(os.path.dirname(FAISS_SAVE_PATH), exist_ok=True)
    
    # Save the database locally
    vector_store.save_local(FAISS_SAVE_PATH)
    print(f"🎉 Success! FAISS database saved to: {FAISS_SAVE_PATH}")

if __name__ == "__main__":
    print("🚀 Booting RAG Ingestion Pipeline...")
    build_rag_database()