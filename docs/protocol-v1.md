# VS Code Bridge Protocol v1

This file is generated. Canonical schemas: `protocol/schemas/v1.json`.

## Methods
### bridge.ping

VS Code Bridge method: bridge.ping

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "ok",
    "protocol"
  ],
  "properties": {
    "ok": {
      "const": true
    },
    "protocol": {
      "type": "string"
    }
  }
}
```

### bridge.capabilities

VS Code Bridge method: bridge.capabilities

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "methods",
    "events",
    "limitations"
  ],
  "properties": {
    "methods": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "events": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "limitations": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

### events.subscribe

VS Code Bridge method: events.subscribe

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "replay": {
      "type": "integer",
      "minimum": 0,
      "maximum": 200,
      "default": 0
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "subscriptionId",
    "filter",
    "replayed"
  ],
  "properties": {
    "subscriptionId": {
      "type": "string"
    },
    "filter": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      ]
    },
    "replayed": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

### events.unsubscribe

VS Code Bridge method: events.unsubscribe

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "subscriptionId"
  ],
  "properties": {
    "subscriptionId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "unsubscribed"
  ],
  "properties": {
    "unsubscribed": {
      "type": "boolean"
    }
  }
}
```

### agent.suggestNextSteps

VS Code Bridge method: agent.suggestNextSteps

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "goal": {
      "type": "string"
    },
    "maxSuggestions": {
      "type": "integer",
      "minimum": 1,
      "maximum": 25,
      "default": 8
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "suggestions"
  ],
  "properties": {
    "suggestions": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "id",
          "title",
          "rationale",
          "method",
          "params"
        ],
        "properties": {
          "id": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "rationale": {
            "type": "string"
          },
          "method": {
            "type": "string"
          },
          "params": {
            "type": "object"
          }
        }
      }
    }
  }
}
```

### agent.planAndExecute

VS Code Bridge method: agent.planAndExecute

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "goal"
  ],
  "properties": {
    "goal": {
      "type": "string",
      "minLength": 1
    },
    "dryRun": {
      "type": "boolean",
      "default": true
    },
    "maxSteps": {
      "type": "integer",
      "minimum": 1,
      "maximum": 25,
      "default": 10
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "goal",
    "dryRun",
    "steps",
    "previewUnifiedDiff"
  ],
  "properties": {
    "goal": {
      "type": "string"
    },
    "dryRun": {
      "type": "boolean"
    },
    "txId": {
      "type": [
        "string",
        "null"
      ]
    },
    "steps": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "previewUnifiedDiff": {
      "type": "string"
    },
    "committed": {
      "type": "boolean"
    },
    "rolledBack": {
      "type": "boolean"
    }
  }
}
```

### tx.begin

VS Code Bridge method: tx.begin

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "createdAt"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "createdAt": {
      "type": "integer"
    }
  }
}
```

### tx.preview

VS Code Bridge method: tx.preview

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "fileCount",
    "unifiedDiff",
    "files"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "fileCount": {
      "type": "integer",
      "minimum": 0
    },
    "unifiedDiff": {
      "type": "string"
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "uri",
          "editCount",
          "unifiedDiff"
        ],
        "properties": {
          "uri": {
            "$ref": "#/$defs/Uri"
          },
          "editCount": {
            "type": "integer",
            "minimum": 0
          },
          "unifiedDiff": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

### tx.commit

VS Code Bridge method: tx.commit

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "committed",
    "fileCount"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "committed": {
      "type": "boolean"
    },
    "fileCount": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

### tx.rollback

VS Code Bridge method: tx.rollback

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "rolledBack"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "rolledBack": {
      "type": "boolean"
    }
  }
}
```

### tx.snapshot.create

VS Code Bridge method: tx.snapshot.create

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "snapshotId",
    "kind",
    "stashRef"
  ],
  "properties": {
    "snapshotId": {
      "type": "string"
    },
    "kind": {
      "const": "git-stash"
    },
    "stashRef": {
      "type": "string"
    }
  }
}
```

### tx.snapshot.restore

VS Code Bridge method: tx.snapshot.restore

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "snapshotId",
    "dangerouslyDiscardLocalChanges"
  ],
  "properties": {
    "snapshotId": {
      "type": "string"
    },
    "dangerouslyDiscardLocalChanges": {
      "const": true
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "snapshotId",
    "restored"
  ],
  "properties": {
    "snapshotId": {
      "type": "string"
    },
    "restored": {
      "type": "boolean"
    }
  }
}
```

### doc.read

VS Code Bridge method: doc.read

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "version",
    "languageId",
    "text"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "version": {
      "type": "integer"
    },
    "languageId": {
      "type": "string"
    },
    "text": {
      "type": "string"
    }
  }
}
```

### doc.applyEdits.preview

VS Code Bridge method: doc.applyEdits.preview

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "uri",
    "edits"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "edits": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/TextEdit"
      }
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "uri",
    "editCount",
    "unifiedDiff",
    "impactAnalysis"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "editCount": {
      "type": "integer",
      "minimum": 0
    },
    "unifiedDiff": {
      "type": "string"
    },
    "impactAnalysis": {
      "type": "object"
    }
  }
}
```

### doc.applyEdits.commit

VS Code Bridge method: doc.applyEdits.commit

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "uri"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "applied",
    "newVersion"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "applied": {
      "type": "boolean"
    },
    "newVersion": {
      "type": "integer"
    }
  }
}
```

### diagnostics.list

VS Code Bridge method: diagnostics.list

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "items"
  ],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "uri",
          "diagnostics"
        ],
        "properties": {
          "uri": {
            "$ref": "#/$defs/Uri"
          },
          "diagnostics": {
            "type": "array",
            "items": {
              "type": "object"
            }
          }
        }
      }
    }
  }
}
```

### diagnostics.fix.preview

VS Code Bridge method: diagnostics.fix.preview

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "uri"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "kind": {
      "type": "string",
      "default": "quickfix"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object"
}
```

### diagnostics.fix.commit

VS Code Bridge method: diagnostics.fix.commit

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object"
}
```

### refactor.rename.preview

VS Code Bridge method: refactor.rename.preview

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId",
    "uri",
    "position",
    "newName"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "position": {
      "$ref": "#/$defs/Position"
    },
    "newName": {
      "type": "string",
      "minLength": 1
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object"
}
```

### refactor.rename.commit

VS Code Bridge method: refactor.rename.commit

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "txId"
  ],
  "properties": {
    "txId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object"
}
```

### tasks.run.capture

VS Code Bridge method: tasks.run.capture

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "name"
  ],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "timeoutMs": {
      "type": "integer",
      "minimum": 1000,
      "default": 120000
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "taskId",
    "exitCode",
    "output",
    "failureSummary",
    "limitations"
  ],
  "properties": {
    "taskId": {
      "type": "string"
    },
    "exitCode": {
      "oneOf": [
        {
          "type": "integer"
        },
        {
          "type": "null"
        }
      ]
    },
    "output": {},
    "failureSummary": {},
    "limitations": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

### workspace.info

VS Code Bridge method: workspace.info

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "folders"
  ],
  "properties": {
    "folders": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "uri": {
            "$ref": "#/$defs/Uri"
          }
        }
      }
    },
    "name": {
      "type": [
        "string",
        "null"
      ]
    }
  }
}
```

### diagnostics.subscribe

VS Code Bridge method: diagnostics.subscribe

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "subscribed"
  ],
  "properties": {
    "subscribed": {
      "type": "boolean"
    }
  }
}
```

### doc.applyEdits

VS Code Bridge method: doc.applyEdits

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "edits"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "edits": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/TextEdit"
      }
    },
    "expectedVersion": {
      "type": "integer"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "applied",
    "newVersion"
  ],
  "properties": {
    "applied": {
      "type": "boolean"
    },
    "newVersion": {
      "type": "integer"
    }
  }
}
```

### doc.format

VS Code Bridge method: doc.format

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "applied",
    "editCount"
  ],
  "properties": {
    "applied": {
      "type": "boolean"
    },
    "editCount": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

### tasks.list

VS Code Bridge method: tasks.list

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "tasks"
  ],
  "properties": {
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "source": {
            "type": "string"
          },
          "type": {
            "type": [
              "string",
              "null"
            ]
          }
        }
      }
    }
  }
}
```

### tasks.run

VS Code Bridge method: tasks.run

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "name"
  ],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "taskId"
  ],
  "properties": {
    "taskId": {
      "type": "string"
    }
  }
}
```

### tasks.terminate

VS Code Bridge method: tasks.terminate

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "taskId"
  ],
  "properties": {
    "taskId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "terminated"
  ],
  "properties": {
    "terminated": {
      "type": "boolean"
    }
  }
}
```

### code.definitions

VS Code Bridge method: code.definitions

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "position"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "position": {
      "$ref": "#/$defs/Position"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "items"
  ],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  }
}
```

### code.references

VS Code Bridge method: code.references

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "position"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "position": {
      "$ref": "#/$defs/Position"
    },
    "includeDeclaration": {
      "type": "boolean",
      "default": true
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "items"
  ],
  "properties": {
    "includeDeclaration": {
      "type": "boolean"
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  }
}
```

### code.symbols.document

VS Code Bridge method: code.symbols.document

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "items"
  ],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  }
}
```

### code.symbols.workspace

VS Code Bridge method: code.symbols.workspace

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "query": {
      "type": "string",
      "default": ""
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "items"
  ],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  }
}
```

### code.hover

VS Code Bridge method: code.hover

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "position"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "position": {
      "$ref": "#/$defs/Position"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "items"
  ],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  }
}
```

### ui.openFile

VS Code Bridge method: ui.openFile

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "preview": {
      "type": "boolean",
      "default": true
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "shown"
  ],
  "properties": {
    "shown": {
      "type": "boolean"
    }
  }
}
```

### ui.revealRange

VS Code Bridge method: ui.revealRange

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "range"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "range": {
      "$ref": "#/$defs/Range"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "revealed"
  ],
  "properties": {
    "revealed": {
      "type": "boolean"
    }
  }
}
```

### ui.focus

VS Code Bridge method: ui.focus

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "command"
  ],
  "properties": {
    "command": {
      "type": "string",
      "minLength": 1
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "focused"
  ],
  "properties": {
    "focused": {
      "type": "boolean"
    }
  }
}
```

### ui.openPanel

VS Code Bridge method: ui.openPanel

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "command"
  ],
  "properties": {
    "command": {
      "type": "string",
      "minLength": 1
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "opened"
  ],
  "properties": {
    "opened": {
      "type": "boolean"
    }
  }
}
```

### ui.quickPick

VS Code Bridge method: ui.quickPick

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "items"
  ],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "id": {
            "type": "string"
          }
        }
      }
    },
    "placeholder": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "pickedId"
  ],
  "properties": {
    "pickedId": {
      "type": [
        "string",
        "null"
      ]
    }
  }
}
```

### debug.sessions

VS Code Bridge method: debug.sessions

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "sessions",
    "activeSession"
  ],
  "properties": {
    "sessions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "type": {
            "type": "string"
          }
        }
      }
    },
    "activeSession": {
      "type": [
        "object",
        "null"
      ]
    }
  }
}
```

### debug.start

VS Code Bridge method: debug.start

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "configuration"
  ],
  "properties": {
    "folderUri": {
      "$ref": "#/$defs/Uri"
    },
    "configuration": {
      "type": "object"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "started"
  ],
  "properties": {
    "started": {
      "type": "boolean"
    }
  }
}
```

### debug.stop

VS Code Bridge method: debug.stop

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "sessionId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "stopped"
  ],
  "properties": {
    "stopped": {
      "type": "boolean"
    }
  }
}
```

### debug.subscribe

VS Code Bridge method: debug.subscribe

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "subscribed"
  ],
  "properties": {
    "subscribed": {
      "type": "boolean"
    }
  }
}
```

### notebook.open

VS Code Bridge method: notebook.open

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "show": {
      "type": "boolean",
      "default": false
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "notebookType",
    "cellCount"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "notebookType": {
      "type": "string"
    },
    "cellCount": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

### notebook.read

VS Code Bridge method: notebook.read

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "notebookType",
    "cells"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "notebookType": {
      "type": "string"
    },
    "cells": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "index": {
            "type": "integer"
          },
          "kind": {
            "type": "integer"
          },
          "languageId": {
            "type": "string"
          },
          "text": {
            "type": "string"
          }
        }
      }
    }
  }
}
```

### notebook.executeCells

VS Code Bridge method: notebook.executeCells

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "start",
    "end"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "start": {
      "type": "integer",
      "minimum": 0
    },
    "end": {
      "type": "integer",
      "minimum": 0
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "started"
  ],
  "properties": {
    "started": {
      "type": "boolean"
    }
  }
}
```

### refactor.rename

VS Code Bridge method: refactor.rename

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "position",
    "newName"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "position": {
      "$ref": "#/$defs/Position"
    },
    "newName": {
      "type": "string",
      "minLength": 1
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "applied"
  ],
  "properties": {
    "applied": {
      "type": "boolean"
    }
  }
}
```

### refactor.codeActions

VS Code Bridge method: refactor.codeActions

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "range"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "range": {
      "$ref": "#/$defs/Range"
    },
    "kind": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "actions"
  ],
  "properties": {
    "actions": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  }
}
```

### refactor.codeActions.apply

VS Code Bridge method: refactor.codeActions.apply

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "actionId"
  ],
  "properties": {
    "actionId": {
      "type": "string"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "applied"
  ],
  "properties": {
    "applied": {
      "type": "boolean"
    },
    "editApplied": {
      "type": "boolean"
    },
    "commandExecuted": {
      "type": "boolean"
    }
  }
}
```

### refactor.organizeImports

VS Code Bridge method: refactor.organizeImports

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "applied",
    "editCount"
  ],
  "properties": {
    "applied": {
      "type": "boolean"
    },
    "editCount": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

### refactor.fixAll

VS Code Bridge method: refactor.fixAll

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "editCount",
    "commandCount"
  ],
  "properties": {
    "editCount": {
      "type": "integer",
      "minimum": 0
    },
    "commandCount": {
      "type": "integer",
      "minimum": 0
    }
  }
}
```

### symbols.deepContext

VS Code Bridge method: symbols.deepContext

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "maxDepth": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5,
      "default": 1
    },
    "includeBlame": {
      "type": "boolean",
      "default": true
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "uri",
    "symbols",
    "callGraph",
    "blame"
  ],
  "properties": {
    "uri": {
      "$ref": "#/$defs/Uri"
    },
    "symbols": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "callGraph": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": {
            "type": "object"
          },
          "to": {
            "type": "array",
            "items": {
              "type": "object"
            }
          }
        }
      }
    },
    "blame": {
      "type": [
        "array",
        "null"
      ],
      "items": {
        "type": "object"
      }
    }
  }
}
```

### debug.runTestAndCaptureFailure

VS Code Bridge method: debug.runTestAndCaptureFailure

Input schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "configuration"
  ],
  "properties": {
    "configuration": {
      "type": "object"
    },
    "folderUri": {
      "$ref": "#/$defs/Uri"
    },
    "timeoutMs": {
      "type": "integer",
      "minimum": 1000,
      "default": 120000
    },
    "auth": {
      "type": "object"
    },
    "meta": {
      "$ref": "#/$defs/Meta"
    }
  }
}
```

Output schema:
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "started",
    "exitedCleanly",
    "diagnosticsAfter",
    "failures"
  ],
  "properties": {
    "started": {
      "type": "boolean"
    },
    "exitedCleanly": {
      "type": "boolean"
    },
    "diagnosticsAfter": {
      "type": "array",
      "items": {
        "type": "object"
      }
    },
    "failures": {
      "type": "array",
      "items": {
        "type": "object"
      }
    }
  }
}
```

