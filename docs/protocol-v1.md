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

