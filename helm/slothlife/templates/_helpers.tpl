{{/*
Expand the name of the chart.
*/}}
{{- define "slothlife.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Default fully qualified app name. Truncated to 63 chars so
it never overruns the DNS-1123 limit.
*/}}
{{- define "slothlife.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Chart label string (helm.sh/chart).
*/}}
{{- define "slothlife.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels for every resource the chart owns.
*/}}
{{- define "slothlife.labels" -}}
helm.sh/chart: {{ include "slothlife.chart" . }}
{{ include "slothlife.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels — must be stable across upgrades, so version
and chart labels are intentionally NOT included here.
*/}}
{{- define "slothlife.selectorLabels" -}}
app.kubernetes.io/name: {{ include "slothlife.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Resolve the container image. .Values.image.tag wins; otherwise
fall back to .Chart.AppVersion so a `helm install` without a
tag override still produces a deterministic reference.
*/}}
{{- define "slothlife.image" -}}
{{- $tag := default .Chart.AppVersion .Values.image.tag -}}
{{- printf "%s:%s" .Values.image.repository $tag -}}
{{- end -}}
