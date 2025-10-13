'use client';

import React from 'react';
import { Progress, Card, CardBody } from '@nextui-org/react';

interface LoadingStateProps {
  message?: string;
  progress?: number;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  progress,
}) => {
  return (
    <Card className="w-full">
      <CardBody className="gap-3">
        <div className="flex items-center gap-3">
          <div className="animate-spin text-2xl">🔄</div>
          <div className="flex-1">
            <p className="text-sm font-medium">{message}</p>
            {progress !== undefined && (
              <Progress
                size="sm"
                value={progress}
                color="primary"
                className="mt-2"
                showValueLabel
              />
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default LoadingState;
