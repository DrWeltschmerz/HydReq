package newman

import (
	"io"

	"github.com/DrWeltschmerz/HydReq/internal/adapters/postman"
	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Convert parses a Newman collection and converts it to a HydReq suite
// Newman uses the same Postman collection format (v2.1), but may include
// additional CLI-specific features or run configurations
func Convert(r io.Reader, envVars map[string]string) (*models.Suite, error) {
	// For now, delegate to the Postman adapter since Newman uses the same format
	// TODO: Add any Newman-specific features like run configurations, data files, etc.
	return postman.Convert(r, envVars)
}
