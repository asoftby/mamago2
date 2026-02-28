"use client"

import * as React from "react"

export function useMockFilters() {
  const [age, setAge] = React.useState<string[]>([])
  const [district, setDistrict] = React.useState<string[]>([])
  const [metro, setMetro] = React.useState<string[]>([])
  const [category, setCategory] = React.useState<string[]>([])
  const [skill, setSkill] = React.useState<string[]>([])
  const [tool, setTool] = React.useState<string[]>([])

  return { 
    age, setAge, 
    district, setDistrict, 
    metro, setMetro,
    category, setCategory,
    skill, setSkill,
    tool, setTool
  }
}
