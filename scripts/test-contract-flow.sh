#!/bin/bash

# Test Contract Flow
# This script helps test the complete contract flow from CLI

PACKAGE_ID="0x2e799b3d9cb329711ce4bc09c9bae46bf09346fbcc6dea0398879bb626a49ee1"

echo "======================================"
echo "Matching.Me Contract Testing Helper"
echo "======================================"
echo ""
echo "Package ID: $PACKAGE_ID"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if sui CLI is installed
if ! command -v sui &> /dev/null; then
    print_error "Sui CLI is not installed. Please install from: https://docs.sui.io/guides/developer/getting-started/sui-install"
    exit 1
fi

print_info "Sui CLI found: $(sui --version)"
echo ""

# Get active address
ACTIVE_ADDRESS=$(sui client active-address)
print_info "Active address: $ACTIVE_ADDRESS"
echo ""

# Menu
echo "Select a test action:"
echo "1. View package info"
echo "2. Get shared object IDs"
echo "3. Create profile"
echo "4. Query profile"
echo "5. View all owned objects"
echo "6. Get gas balance"
echo "7. Request testnet tokens"
echo "8. View transaction"
echo "0. Exit"
echo ""

read -p "Enter choice: " choice

case $choice in
    1)
        print_step "Viewing package info..."
        sui client object $PACKAGE_ID
        ;;

    2)
        print_step "Getting shared object IDs..."
        echo ""
        read -p "Enter deploy transaction digest (or press Enter to skip): " TX_DIGEST

        if [ -z "$TX_DIGEST" ]; then
            print_info "No transaction digest provided. Showing search commands:"
            echo ""
            echo "# ProfileRegistry"
            echo "sui client objects --filter \"StructType==${PACKAGE_ID}::core::ProfileRegistry\""
            echo ""
            echo "# ChatRegistry"
            echo "sui client objects --filter \"StructType==${PACKAGE_ID}::chat::ChatRegistry\""
            echo ""
            echo "# UsageTracker"
            echo "sui client objects --filter \"StructType==${PACKAGE_ID}::integration::UsageTracker\""
            echo ""
            echo "Or use the TypeScript script:"
            echo "npx tsx scripts/get-shared-objects.ts <DEPLOY_TX_DIGEST>"
        else
            sui client transaction-block $TX_DIGEST
        fi
        ;;

    3)
        print_step "Creating profile..."
        echo ""
        read -p "Enter name: " NAME
        read -p "Enter bio: " BIO
        read -p "Enter age: " AGE
        read -p "Enter gender (0=Male, 1=Female, 2=Other): " GENDER
        read -p "Enter interests (comma separated): " INTERESTS

        print_info "This will create a transaction. Gas will be deducted."
        read -p "Continue? (y/n): " CONFIRM

        if [ "$CONFIRM" == "y" ]; then
            # Note: This is a simplified example. Actual implementation needs proper vector handling
            print_error "CLI profile creation requires complex argument formatting."
            print_info "Please use the web UI at: http://localhost:3000/test-contract"
            print_info "Or use the Sui Move CLI with proper argument files."
        fi
        ;;

    4)
        print_step "Querying profile..."
        echo ""
        read -p "Enter profile object ID: " PROFILE_ID

        if [ -z "$PROFILE_ID" ]; then
            print_error "Profile ID is required"
        else
            sui client object $PROFILE_ID --json
        fi
        ;;

    5)
        print_step "Viewing all owned objects..."
        sui client objects
        ;;

    6)
        print_step "Getting gas balance..."
        sui client gas
        ;;

    7)
        print_step "Requesting testnet tokens..."
        print_info "Your address: $ACTIVE_ADDRESS"
        echo ""
        echo "Option 1: Use CLI"
        echo "  sui client faucet"
        echo ""
        echo "Option 2: Use web faucet"
        echo "  https://faucet.sui.io/"
        echo ""
        read -p "Request tokens via CLI? (y/n): " FAUCET_CONFIRM

        if [ "$FAUCET_CONFIRM" == "y" ]; then
            sui client faucet
        fi
        ;;

    8)
        print_step "Viewing transaction..."
        echo ""
        read -p "Enter transaction digest: " TX_DIGEST

        if [ -z "$TX_DIGEST" ]; then
            print_error "Transaction digest is required"
        else
            sui client transaction-block $TX_DIGEST
            echo ""
            print_info "View on explorer:"
            echo "https://suiscan.xyz/testnet/tx/$TX_DIGEST"
        fi
        ;;

    0)
        print_info "Exiting..."
        exit 0
        ;;

    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "Test complete!"
echo "======================================"
