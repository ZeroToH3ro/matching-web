import React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";
import { cn } from "@/lib/utils";

export default function Filters() {
  const {
    orderByList,
    genderList,
    selectAge,
    selectGender,
    selectOrder,

    filters,
    totalCount,
    isPending,
  } = useFilters();

  const { gender, ageRange, orderBy } = filters;

  return (
    <div className="border-b bg-gradient-to-r from-background via-muted/20 to-background shadow-sm backdrop-blur-sm">
      <div className="container mx-auto py-4 px-4 lg:px-6">
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-row justify-between items-center gap-6">
          {/* Results Count */}
          <div className="flex items-center gap-2 min-w-[140px]">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Results:</span>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Badge variant="secondary" className="font-bold text-base px-3">
                  {totalCount}
                </Badge>
              )}
            </div>
          </div>

          {/* Gender Filter */}
          <div className="flex gap-2 items-center">
            <Label className="text-sm font-medium">Gender:</Label>
            <div className="flex gap-1">
              {genderList.map(({ icon: Icon, value }) => (
                <Button
                  key={value}
                  size="sm"
                  variant={gender.includes(value) ? "default" : "outline"}
                  className={cn(
                    "h-9 w-9 p-0 transition-all duration-300",
                    gender.includes(value) && "shadow-md scale-105"
                  )}
                  onClick={() => selectGender(value)}
                >
                  <Icon size={18} />
                </Button>
              ))}
            </div>
          </div>

          {/* Age Range Slider */}
          <div className="flex flex-col gap-2 min-w-[240px]">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Age Range</Label>
              <span className="text-sm text-muted-foreground font-medium">
                {ageRange[0]} - {ageRange[1]}
              </span>
            </div>
            <Slider
              min={18}
              max={100}
              step={1}
              value={ageRange}
              onValueChange={(value) => selectAge(value)}
              className="w-full"
            />
          </div>



          {/* Order By Select */}
          <div className="min-w-[180px]">
            <Select value={orderBy} onValueChange={selectOrder}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Order by" />
              </SelectTrigger>
              <SelectContent>
                {orderByList.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-4">
          {/* Results and Photo Switch Row */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Results:</span>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Badge variant="secondary" className="font-bold">
                  {totalCount}
                </Badge>
              )}
            </div>

          </div>

          {/* Gender and Order Row */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex gap-2 items-center">
              <Label className="text-sm font-medium">Gender:</Label>
              {genderList.map(({ icon: Icon, value }) => (
                <Button
                  key={value}
                  size="sm"
                  variant={gender.includes(value) ? "default" : "outline"}
                  className="h-8 w-8 p-0"
                  onClick={() => selectGender(value)}
                >
                  <Icon size={16} />
                </Button>
              ))}
            </div>
            <div className="flex-1 max-w-[140px]">
              <Select value={orderBy} onValueChange={selectOrder}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderByList.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Age Range Row */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">Age Range</Label>
              <span className="text-xs text-muted-foreground font-medium">
                {ageRange[0]} - {ageRange[1]}
              </span>
            </div>
            <Slider
              min={18}
              max={100}
              step={1}
              value={ageRange}
              onValueChange={(value) => selectAge(value)}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
