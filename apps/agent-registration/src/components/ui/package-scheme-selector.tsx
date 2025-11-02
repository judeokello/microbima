"use client"

import * as React from "react"
import { Package, Scheme, getPackages, getPackageSchemes } from "@/lib/api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface PackageSchemeSelectorProps {
  selectedPackageId?: number
  selectedSchemeId?: number
  onPackageChange: (packageId: number | undefined) => void
  onSchemeChange: (schemeId: number | undefined) => void
  className?: string
  disabled?: boolean
}

export function PackageSchemeSelector({
  selectedPackageId,
  selectedSchemeId,
  onPackageChange,
  onSchemeChange,
  className,
  disabled = false,
}: PackageSchemeSelectorProps) {
  const [packages, setPackages] = React.useState<Package[]>([])
  const [schemes, setSchemes] = React.useState<Scheme[]>([])
  const [loadingPackages, setLoadingPackages] = React.useState(false)
  const [loadingSchemes, setLoadingSchemes] = React.useState(false)

  // Load packages on mount
  React.useEffect(() => {
    const loadPackages = async () => {
      setLoadingPackages(true)
      try {
        const data = await getPackages()
        setPackages(data)
      } catch (error) {
        console.error("Error loading packages:", error)
      } finally {
        setLoadingPackages(false)
      }
    }

    loadPackages()
  }, [])

  // Load schemes when package is selected
  React.useEffect(() => {
    const loadSchemes = async () => {
      if (!selectedPackageId) {
        setSchemes([])
        onSchemeChange(undefined)
        return
      }

      setLoadingSchemes(true)
      try {
        const data = await getPackageSchemes(selectedPackageId)
        setSchemes(data)
      } catch (error) {
        console.error("Error loading schemes:", error)
        setSchemes([])
      } finally {
        setLoadingSchemes(false)
      }
    }

    loadSchemes()
  }, [selectedPackageId, onSchemeChange])

  const handlePackageChange = (value: string) => {
    const packageId = value === "none" ? undefined : parseInt(value, 10)
    onPackageChange(packageId)
  }

  const handleSchemeChange = (value: string) => {
    const schemeId = value === "none" ? undefined : parseInt(value, 10)
    onSchemeChange(schemeId)
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      <div className="space-y-2">
        <Label htmlFor="package-select">Package</Label>
        <Select
          value={selectedPackageId?.toString() ?? "none"}
          onValueChange={handlePackageChange}
          disabled={disabled || loadingPackages}
        >
          <SelectTrigger id="package-select">
            <SelectValue placeholder={loadingPackages ? "Loading..." : "Select package"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {packages.map((pkg) => (
              <SelectItem key={pkg.id} value={pkg.id.toString()}>
                {pkg.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheme-select">Scheme</Label>
        <Select
          value={selectedSchemeId?.toString() ?? "none"}
          onValueChange={handleSchemeChange}
          disabled={disabled || !selectedPackageId || loadingSchemes}
        >
          <SelectTrigger id="scheme-select">
            <SelectValue
              placeholder={
                !selectedPackageId
                  ? "Select package first"
                  : loadingSchemes
                    ? "Loading..."
                    : "Select scheme"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {schemes.map((scheme) => (
              <SelectItem key={scheme.id} value={scheme.id.toString()}>
                {scheme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

