import { lspRagService } from '../services/lspRagService.js';

export const getIndexSummary = async (req, res, next) => {
  try {
    const index = await lspRagService.indexWorkspace(req.params.workspaceId, req.query.refresh === 'true');
    res.json({
      success: true,
      filesCount: index.files.length,
      symbolsCount: index.symbols.length,
      symbols: index.symbols.slice(0, 150),
    });
  } catch (err) {
    next(err);
  }
};

export const getCompletions = async (req, res, next) => {
  try {
    const items = await lspRagService.getCompletions(req.params.workspaceId, req.body || {});
    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
};

export const getInlineSuggestion = async (req, res, next) => {
  try {
    const result = await lspRagService.getInlineSuggestion(req.params.workspaceId, req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getDefinition = async (req, res, next) => {
  try {
    const definitions = await lspRagService.findDefinition(req.params.workspaceId, req.body?.symbol || '');
    res.json({ success: true, definitions });
  } catch (err) {
    next(err);
  }
};

export const getDiagnostics = async (req, res, next) => {
  try {
    const result = lspRagService.runDiagnostics(req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const queryLspRag = async (req, res, next) => {
  try {
    const result = await lspRagService.queryRag(req.params.workspaceId, req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
