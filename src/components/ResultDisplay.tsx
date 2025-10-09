'use client';

import React from 'react';
import { Card, CardBody, Button } from '@nextui-org/react';
import { Download, RotateCcw } from 'lucide-react';

interface ResultDisplayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onReset?: () => void;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({
  canvasRef,
  onReset,
}) => {
  const handleDownload = () => {
    if (canvasRef.current) {
      const link = document.createElement('a');
      link.download = `face-swap-${Date.now()}.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <Card className="w-full">
      <CardBody className="gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Result</h2>
          {onReset && (
            <Button
              size="sm"
              variant="flat"
              startContent={<RotateCcw className="w-4 h-4" />}
              onPress={onReset}
            >
              Start Over
            </Button>
          )}
        </div>

        <div className="w-full flex justify-center bg-default-100 rounded-lg p-4">
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto rounded-md shadow-lg"
          />
        </div>

        <Button
          color="success"
          variant="shadow"
          startContent={<Download className="w-4 h-4" />}
          onPress={handleDownload}
          className="w-full"
          size="lg"
        >
          Download Result
        </Button>
      </CardBody>
    </Card>
  );
};

export default ResultDisplay;
