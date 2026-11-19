import { useEffect, useRef, useState } from "react";
import { effortById, type EffortId } from "../../lib/effort";
import { readLocal, writeLocal } from "../../lib/storage";
import type { ModelChoice } from "./ModelMenu";
import { useChat } from "../../stores/chat";
import { useKnowledge } from "../../stores/knowledge";
import { useModels } from "../../stores/models";
import { useUi } from "../../stores/ui";
import { SourceList } from "../knowledge/SourceList";
import type { KnowledgeCollection } from "../../lib/api";

/**
 * Sabit boş dizi. Seçicinin her çağrıda yeni `[]` döndürmesi zustand'in
 * referans karşılaştırmasını her seferinde yanıltır ve sonsuz render
 * döngüsü açar.
 */
const NO_COLLECTIONS: KnowledgeCollection[] = [];
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

const CHOICE_KEY = "studio.chat.model";
const EFFORT_KEY = "studio.chat.effort";

function readChoice(): ModelChoice | null {
  try {
    const parsed = JSON.parse(readLocal(CHOICE_KEY) ?? "null") as ModelChoice | null;
    return parsed && typeof parsed.provider === "string" && typeof parsed.model === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function ChatView() {
  const t = useUi((s) => s.t);
  const {
    messages, sending, error, usage, sources, sourceError, collectionId,
    send, stop, loadConversations, setCollection,
  } = useChat();
  const { engine, providers, providerModels, refresh, loadProviderModels, busy } = useModels();
  const collections = useKnowledge((s) => s.overview?.collections ?? NO_COLLECTIONS);
  const refreshKnowledge = useKnowledge((s) => s.refresh);

  const [choice, setChoice] = useState<ModelChoice | null>(() => readChoice());
  const [effort, setEffort] = useState<EffortId>(() => effortById(readLocal(EFFORT_KEY)).id);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadConversations();
    void refresh();
    void refreshKnowledge();
  }, [loadConversations, refresh, refreshKnowledge]);

  // Modeller sekmesinden başka bir model yüklendiyse seçici onu izlesin.
  useEffect(() => {
    if (engine?.state !== "ready") return;
    if (!choice || (choice.provider === "llamacpp" && choice.model !== engine.model)) {
      choose({ provider: "llamacpp", model: engine.model });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine?.state, engine?.model]);

  useEffect(() => {
    if (choice && choice.provider !== "llamacpp" && !providerModels[choice.provider]) {
      void loadProviderModels(choice.provider);
    }
  }, [choice, providerModels, loadProviderModels]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function choose(next: ModelChoice) {
    setChoice(next);
    writeLocal(CHOICE_KEY, JSON.stringify(next));
  }

  const isLocal = choice?.provider === "llamacpp";
  const cloudReady = Boolean(
    choice && !isLocal && providers.find((p) => p.id === choice.provider)?.hasKey,
  );
  const localReady = isLocal && engine?.state === "ready" && engine.model === choice?.model;
  const ready = localReady || cloudReady;
  const blockedReason = !choice
    ? t("chat.pickModel")
    : isLocal && (busy || engine?.state === "starting")
      ? t("chat.modelLoading")
      : isLocal && !localReady
        ? t("chat.loadModelFirst")
        : null;

  const preset = effortById(effort);

  return (
    <div className="chat">
      <ConversationList />

      <div className="chat__main">
        <header className="chat__bar">
          <span className="chat__title">
            {choice ? (isLocal ? t("chat.localBadge") : choice.provider) : ""}
          </span>
          <span className="composer__spacer" />
          {collections.length > 0 && (
            <label className="field field--inline">
              <span className="field__label">{t("chat.knowledge")}</span>
              <select
                className="input input--compact"
                value={collectionId ?? ""}
                onChange={(event) => setCollection(event.target.value || null)}
              >
                <option value="">{t("chat.noKnowledge")}</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {usage && (
            <span className="chat__usage" title={t("chat.usageTitle")}>
              {usage.promptTokens} + {usage.completionTokens}
            </span>
          )}
        </header>

        <div className="chat__scroll">
          {messages.length === 0 && !blockedReason && (
            <p className="chat__empty">{t("chat.empty")}</p>
          )}
          {blockedReason && <p className="chat__empty">{blockedReason}</p>}
          <MessageList messages={messages} />
          {sourceError && <p className="chat__error" role="alert">{sourceError}</p>}
          {sources.length > 0 && (
            <details className="chat__sources">
              <summary>{t("chat.sourcesUsed", { n: sources.length })}</summary>
              <SourceList sources={sources} />
            </details>
          )}
          {error && <p className="chat__error" role="alert">{error}</p>}
          <div ref={bottomRef} />
        </div>

        <Composer
          disabled={!ready}
          sending={sending}
          canSendImages={!isLocal || Boolean(engine?.projector)}
          choice={choice}
          effort={effort}
          onChoose={choose}
          onEffort={(next) => {
            setEffort(next);
            writeLocal(EFFORT_KEY, next);
          }}
          onSend={(text, images) =>
            choice &&
            void send(text, {
              provider: choice.provider,
              model: isLocal && engine ? engine.model : choice.model,
              images,
              temperature: preset.temperature,
              maxTokens: preset.maxTokens,
              effortPrompt: preset.prompt,
            })
          }
          onStop={stop}
        />
      </div>
    </div>
  );
}
