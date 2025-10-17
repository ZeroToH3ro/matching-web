import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
} from "@nextui-org/react";
import type { ReactNode } from "react";
import type { IconType } from "react-icons/lib";

type Props = {
  body?: ReactNode;
  headerIcon: IconType;
  headerText: string;
  subHeaderText?: string;
  action?: () => void;
  actionLabel?: string;
  footer?: ReactNode;
};

export default function CardWrapper({
  body,
  footer,
  headerIcon: Icon,
  headerText,
  subHeaderText,
  action,
  actionLabel,
}: Props) {
  return (
    <div className="flex items-center justify-center vertical-center px-4">
      <Card className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:w-2/5 mx-auto p-4 sm:p-5">
        <CardHeader className="flex flex-col items-center justify-center">
          <div className="flex flex-col gap-2 items-center text-default">
            <div className="flex flex-row items-center gap-2 sm:gap-3">
              <Icon size={24} className="sm:w-[30px] sm:h-[30px]" />
              <h1 className="text-2xl sm:text-3xl font-semibold text-center">
                {headerText}
              </h1>
            </div>
            {subHeaderText && (
              <p className="text-neutral-500 text-sm sm:text-base text-center px-2">
                {subHeaderText}
              </p>
            )}
          </div>
        </CardHeader>
        {body && <CardBody>{body}</CardBody>}
        <CardFooter className="flex flex-col justify-center">
          {action && (
            <Button
              onClick={action}
              fullWidth
              color="default"
              variant="bordered"
            >
              {actionLabel}
            </Button>
          )}
          {footer && <>{footer}</>}
        </CardFooter>
      </Card>
    </div>
  );
}
