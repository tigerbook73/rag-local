export interface paths {
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Health check */
        get: operations["HealthController_check"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Queue connectivity health check */
        get: operations["HealthController_checkQueue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health/db": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Database connectivity health check */
        get: operations["HealthController_checkDb"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["SettingsController_getSettings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["SettingsController_updateSettings"];
        trace?: never;
    };
    "/api/v1/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["DocumentsController_findAll"];
        put?: never;
        post: operations["DocumentsController_upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["DocumentsController_findOne"];
        put?: never;
        post?: never;
        delete: operations["DocumentsController_remove"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["DocumentsController_retry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["ConversationsController_findAll"];
        put?: never;
        post: operations["ConversationsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/conversations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["ConversationsController_remove"];
        options?: never;
        head?: never;
        patch: operations["ConversationsController_update"];
        trace?: never;
    };
    "/api/v1/conversations/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MessagesController_findAll"];
        put?: never;
        post: operations["MessagesController_sendMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/messages/{id}/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["MessagesController_updateFeedback"];
        trace?: never;
    };
    "/api/v1/messages/{id}/evaluation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MessagesController_getEvaluation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["PromptTemplatesController_findAll"];
        put?: never;
        post: operations["PromptTemplatesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/prompt-templates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["PromptTemplatesController_remove"];
        options?: never;
        head?: never;
        patch: operations["PromptTemplatesController_update"];
        trace?: never;
    };
    "/api/v1/quality/evaluations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["QualityController_listEvaluations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/beir-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["QualityController_listBeirRuns"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality/beir-runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["QualityController_getBeirRunDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AppSettingsResponseDto: {
            /** @enum {string} */
            llmProvider: "openai" | "deepseek";
            /** @enum {string} */
            chunkingStrategy: "fixed" | "semantic";
            chunkSize: number;
            chunkOverlap: number;
            hydeEnabled: boolean;
            rerankingEnabled: boolean;
            topK: number;
            onlineEvaluationEnabled: boolean;
            conversationHistoryWindow: number;
            /** @enum {boolean} */
            requiresReindex?: true;
        };
        UpdateSettingsDto: {
            /** @enum {string} */
            llmProvider?: "openai" | "deepseek";
            /** @enum {string} */
            chunkingStrategy?: "fixed" | "semantic";
            chunkSize?: number;
            chunkOverlap?: number;
            hydeEnabled?: boolean;
            rerankingEnabled?: boolean;
            topK?: number;
            onlineEvaluationEnabled?: boolean;
            conversationHistoryWindow?: number;
        };
        UploadDocumentDto: {
            /** Format: binary */
            file: string;
        };
        UploadDocumentResponseDto: {
            id: string;
            filename: string;
            /** @enum {string} */
            status: "pending" | "processing" | "done" | "failed";
        };
        DocumentResponseDto: {
            id: string;
            filename: string;
            /** @enum {string} */
            fileType: "txt" | "md" | "dataset";
            /** @enum {string} */
            status: "pending" | "processing" | "done" | "failed";
            errorMessage?: string | null;
            /** @enum {string} */
            chunkingStrategy: "fixed" | "semantic";
            chunkSize: number;
            chunkOverlap: number;
            totalChunks?: number | null;
            processedChunks?: number | null;
            processingCompletedAt?: string | null;
            createdAt: string;
        };
        DocumentListResponseDto: {
            data: components["schemas"]["DocumentResponseDto"][];
        };
        RetryDocumentResponseDto: {
            /** @enum {string} */
            status: "pending";
        };
        ConversationCreateResponseDto: {
            id: string;
            title: string;
            createdAt: string;
        };
        ConversationResponseDto: {
            id: string;
            title: string;
            createdAt: string;
            updatedAt: string;
        };
        ConversationListResponseDto: {
            data: components["schemas"]["ConversationResponseDto"][];
            total: number;
        };
        UpdateConversationDto: {
            title: string;
        };
        ConversationUpdateResponseDto: {
            id: string;
            title: string;
        };
        RetrievedChunkResponseDto: {
            chunkId: string;
            documentId: string;
            documentName: string;
            /** @enum {string} */
            fileType: "txt" | "md" | "dataset";
            content: string;
            similarityScore: number;
            rerankScore?: number;
            metadata?: Record<string, never> | null;
        };
        MessageResponseDto: {
            id: string;
            conversationId: string;
            /** @enum {string} */
            role: "user" | "assistant";
            content: string;
            /** @enum {string|null} */
            feedback?: "positive" | "negative" | null;
            retrievedChunks?: components["schemas"]["RetrievedChunkResponseDto"][] | null;
            ttftMs?: number | null;
            totalMs?: number | null;
            retrievalMs?: number | null;
            createdAt: string;
        };
        MessageListResponseDto: {
            data: components["schemas"]["MessageResponseDto"][];
        };
        SendMessageDto: {
            content: string;
        };
        UpdateFeedbackDto: {
            /** @enum {string} */
            feedback: "positive" | "negative";
        };
        EvaluationItemResponseDto: {
            /** @enum {string} */
            metric: "faithfulness" | "answer_relevancy" | "context_precision";
            score: number;
            reason: string | null;
        };
        EvaluationResponseDto: {
            /** @enum {string} */
            status: "pending" | "completed";
            evaluations?: components["schemas"]["EvaluationItemResponseDto"][];
        };
        PromptTemplateResponseDto: {
            id: string;
            name: string;
            content: string;
            isActive: boolean;
            createdAt: string;
            updatedAt: string;
        };
        PromptTemplateListResponseDto: {
            data: components["schemas"]["PromptTemplateResponseDto"][];
        };
        CreatePromptTemplateDto: {
            name: string;
            content: string;
        };
        UpdatePromptTemplateDto: {
            name?: string;
            content?: string;
            isActive?: boolean;
        };
        EvaluationMetricDto: {
            /** @enum {string} */
            metric: "faithfulness" | "answer_relevancy" | "context_precision";
            score: number;
            reason: string | null;
        };
        EvaluationSummaryDto: {
            messageId: string;
            conversationId: string;
            conversationTitle?: string;
            question?: string;
            evaluations: components["schemas"]["EvaluationMetricDto"][];
            createdAt: string;
        };
        EvaluationListResponseDto: {
            data: components["schemas"]["EvaluationSummaryDto"][];
            total: number;
        };
        BeirMetricsDto: {
            ndcg10: number;
            recall10: number;
            recall100: number;
            mrr10: number;
        };
        BeirEvalRunSummaryDto: {
            id: string;
            dataset: string;
            embeddingConfig: string;
            sampleSize: number;
            metrics: components["schemas"]["BeirMetricsDto"];
            createdAt: string;
        };
        BeirRunListResponseDto: {
            data: components["schemas"]["BeirEvalRunSummaryDto"][];
            total: number;
        };
        BeirHitDto: {
            docId: string;
            score: number;
        };
        BeirQueryDetailDto: {
            queryId: string;
            queryText: string;
            hits: components["schemas"]["BeirHitDto"][];
            relevantInTop10: number;
            ndcg10: number;
        };
        BeirEvalRunDetailDto: {
            id: string;
            dataset: string;
            embeddingConfig: string;
            sampleSize: number;
            metrics: components["schemas"]["BeirMetricsDto"];
            details: components["schemas"]["BeirQueryDetailDto"][];
            createdAt: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_check: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HealthController_checkQueue: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    HealthController_checkDb: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    SettingsController_getSettings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AppSettingsResponseDto"];
                };
            };
        };
    };
    SettingsController_updateSettings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateSettingsDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AppSettingsResponseDto"];
                };
            };
        };
    };
    DocumentsController_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentListResponseDto"];
                };
            };
        };
    };
    DocumentsController_upload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["UploadDocumentDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadDocumentResponseDto"];
                };
            };
        };
    };
    DocumentsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentResponseDto"];
                };
            };
        };
    };
    DocumentsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    DocumentsController_retry: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RetryDocumentResponseDto"];
                };
            };
        };
    };
    ConversationsController_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationListResponseDto"];
                };
            };
        };
    };
    ConversationsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationCreateResponseDto"];
                };
            };
        };
    };
    ConversationsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    ConversationsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateConversationDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ConversationUpdateResponseDto"];
                };
            };
        };
    };
    MessagesController_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageListResponseDto"];
                };
            };
        };
    };
    MessagesController_sendMessage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SendMessageDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MessagesController_updateFeedback: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateFeedbackDto"];
            };
        };
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    MessagesController_getEvaluation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationResponseDto"];
                };
            };
        };
    };
    PromptTemplatesController_findAll: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PromptTemplateListResponseDto"];
                };
            };
        };
    };
    PromptTemplatesController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePromptTemplateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PromptTemplateResponseDto"];
                };
            };
        };
    };
    PromptTemplatesController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    PromptTemplatesController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePromptTemplateDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PromptTemplateResponseDto"];
                };
            };
        };
    };
    QualityController_listEvaluations: {
        parameters: {
            query?: {
                conversationId?: string;
                page?: number;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EvaluationListResponseDto"];
                };
            };
        };
    };
    QualityController_listBeirRuns: {
        parameters: {
            query?: {
                dataset?: string;
                page?: number;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BeirRunListResponseDto"];
                };
            };
        };
    };
    QualityController_getBeirRunDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BeirEvalRunDetailDto"];
                };
            };
        };
    };
}
