"use client";

import { Card, CardBody, CardHeader, Chip, Code, Divider } from "@nextui-org/react";
import { SuiObjectChange } from "@mysten/sui/client";

interface ObjectChangesDisplayProps {
  objectChanges?: SuiObjectChange[];
  title?: string;
}

export default function ObjectChangesDisplay({
  objectChanges,
  title = "Object Changes"
}: ObjectChangesDisplayProps) {
  if (!objectChanges || objectChanges.length === 0) {
    return null;
  }

  const getChangeColor = (type: string) => {
    switch (type) {
      case "created":
        return "success";
      case "mutated":
        return "warning";
      case "deleted":
        return "danger";
      case "transferred":
        return "primary";
      case "published":
        return "secondary";
      default:
        return "default";
    }
  };

  const getObjectType = (objectType: string) => {
    // Extract the last part of the type for readability
    const parts = objectType.split("::");
    return parts[parts.length - 1] || objectType;
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">{title}</h3>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        {objectChanges.map((change, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Chip
                color={getChangeColor(change.type)}
                size="sm"
                variant="flat"
              >
                {change.type.toUpperCase()}
              </Chip>

              {change.type === "created" && "objectType" in change && (
                <Chip size="sm" variant="bordered">
                  {getObjectType(change.objectType)}
                </Chip>
              )}

              {change.type === "mutated" && "objectType" in change && (
                <Chip size="sm" variant="bordered">
                  {getObjectType(change.objectType)}
                </Chip>
              )}
            </div>

            <div className="space-y-1 text-sm">
              {change.type === "created" && "objectId" in change && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold min-w-24">Object ID:</span>
                    <Code size="sm" className="flex-1">{change.objectId}</Code>
                  </div>
                  {"owner" in change && change.owner && typeof change.owner === "object" && (
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-24">Owner:</span>
                      <Code size="sm" className="flex-1">
                        {"AddressOwner" in change.owner
                          ? change.owner.AddressOwner
                          : JSON.stringify(change.owner)}
                      </Code>
                    </div>
                  )}
                  {"digest" in change && (
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-24">Digest:</span>
                      <Code size="sm" className="flex-1">{change.digest}</Code>
                    </div>
                  )}
                </>
              )}

              {change.type === "mutated" && "objectId" in change && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold min-w-24">Object ID:</span>
                    <Code size="sm" className="flex-1">{change.objectId}</Code>
                  </div>
                  {"previousVersion" in change && (
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-24">Version:</span>
                      <Code size="sm">{change.previousVersion} → {"version" in change ? change.version : "?"}</Code>
                    </div>
                  )}
                </>
              )}

              {change.type === "transferred" && "objectId" in change && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold min-w-24">Object ID:</span>
                    <Code size="sm" className="flex-1">{change.objectId}</Code>
                  </div>
                  {"recipient" in change && change.recipient && typeof change.recipient === "object" && (
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-24">Recipient:</span>
                      <Code size="sm" className="flex-1">
                        {"AddressOwner" in change.recipient
                          ? change.recipient.AddressOwner
                          : JSON.stringify(change.recipient)}
                      </Code>
                    </div>
                  )}
                </>
              )}

              {change.type === "published" && "packageId" in change && (
                <>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold min-w-24">Package ID:</span>
                    <Code size="sm" className="flex-1">{change.packageId}</Code>
                  </div>
                  {"modules" in change && Array.isArray(change.modules) && (
                    <div className="flex items-start gap-2">
                      <span className="font-semibold min-w-24">Modules:</span>
                      <div className="flex flex-wrap gap-1">
                        {change.modules.map((module: string, i: number) => (
                          <Chip key={i} size="sm" variant="flat">{module}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {change.type === "deleted" && "objectId" in change && (
                <div className="flex items-start gap-2">
                  <span className="font-semibold min-w-24">Object ID:</span>
                  <Code size="sm" className="flex-1">{change.objectId}</Code>
                </div>
              )}
            </div>

            {/* Copy button for object IDs */}
            {("objectId" in change) && (
              <button
                onClick={() => {
                  if ("objectId" in change) {
                    navigator.clipboard.writeText(change.objectId);
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline mt-2"
              >
                Copy Object ID
              </button>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
